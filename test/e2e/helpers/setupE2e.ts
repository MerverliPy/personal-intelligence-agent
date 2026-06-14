// ---------------------------------------------------------------------------
// E2E test helpers — fresh test DB + fixture seeding (P3-T10)
// ---------------------------------------------------------------------------
// Mirrors the pattern in packages/db/test/helpers.ts but isolates the
// e2e suite in its own database (pia_e2e_test) so it can run alongside
// the integration and retrieval-eval suites without conflict.
// ---------------------------------------------------------------------------

import { Pool } from 'pg';
import { runMigrations, defaultMigrationsDir } from '@pia/db';

const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, '/postgres') ??
  'postgresql://pia:pia-dev@localhost:5432/postgres';

const TEST_DB_NAME = 'pia_e2e_test';

const TEST_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`) ??
  `postgresql://pia:pia-dev@localhost:5432/${TEST_DB_NAME}`;

let testPool: Pool | undefined;

/**
 * Creates a fresh test database, runs all migrations, and returns a
 * connection pool. Safe to call multiple times — drops + recreates the
 * database on each call.
 */
export async function setupE2eDatabase(): Promise<Pool> {
  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });

  try {
    await adminPool.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid)
       FROM pg_stat_activity
       WHERE pg_stat_activity.datname = $1
         AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME],
    );

    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await adminPool.end();
  }

  testPool = new Pool({ connectionString: TEST_DATABASE_URL });
  const result = await runMigrations(testPool, defaultMigrationsDir());
  if (result.applied.length === 0) {
    throw new Error('No migrations were applied — expected at least 001_base_schema.sql');
  }

  return testPool;
}

export async function teardownE2eDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
  }
}

export { TEST_DATABASE_URL };

// ---------------------------------------------------------------------------
// E2E fixture registry
// ---------------------------------------------------------------------------

/**
 * Minimal fixture registry for the upload-to-feedback e2e test.
 * Mirrors the FixtureRegistry in packages/evals/src/types.ts but is
 * scoped to the e2e suite (one workspace, one user, one document).
 */
export interface E2eFixtureRegistry {
  userId: string;
  workspaceId: string;
  projectId?: string;
  sourceId: string;
  documentId: string;
  documentVersionId: string;
  chunkId: string;
  chunkContent: string;
}

/**
 * Seeds the e2e database with a single workspace, user, source, document,
 * version, chunk, and embedding. Returns a registry of IDs for the test
 * to consume. Uses the fake embedding provider so the chunk is queryable
 * via the same path as production retrieval.
 */
export async function seedE2eFixtures(pool: Pool): Promise<E2eFixtureRegistry> {
  // Disable RLS for e2e fixtures (the e2e suite is a self-contained test
  // environment; workspace authorization is enforced via the orchestrator
  // and API surface, not via the fixture data).
  await disableRls(pool);

  // -- User --
  const userRes = await pool.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'e2e-user@test.com') RETURNING id`,
  );
  const userId = userRes.rows[0]!.id;

  // -- Workspace --
  const wsRes = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'e2e-ws', $1) RETURNING id`,
    [userId],
  );
  const workspaceId = wsRes.rows[0]!.id;
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [workspaceId, userId],
  );

  // -- Source --
  const srcRes = await pool.query<{ id: string }>(
    `INSERT INTO sources (id, workspace_id, name, source_type, created_by)
     VALUES (gen_random_uuid(), $1, 'e2e-source', 'manual_upload', $2)
     RETURNING id`,
    [workspaceId, userId],
  );
  const sourceId = srcRes.rows[0]!.id;

  // -- Stored file --
  const sfRes = await pool.query<{ id: string }>(
    `INSERT INTO stored_files (id, workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, scan_status, created_by)
     VALUES (gen_random_uuid(), $1, 'minio', 'e2e/uploaded.txt', 'uploaded.txt', 1024, $2, 'CLEAN', $3)
     RETURNING id`,
    [workspaceId, 'a'.repeat(64), userId],
  );
  const storedFileId = sfRes.rows[0]!.id;

  // -- Document --
  const docRes = await pool.query<{ id: string }>(
    `INSERT INTO documents (id, workspace_id, source_id, title, sensitivity, created_by)
     VALUES (gen_random_uuid(), $1, $2, 'E2E Document', 'INTERNAL', $3)
     RETURNING id`,
    [workspaceId, sourceId, userId],
  );
  const documentId = docRes.rows[0]!.id;

  // -- Document version (READY, current) --
  const verRes = await pool.query<{ id: string }>(
    `INSERT INTO document_versions (id, workspace_id, document_id, stored_file_id, version_number, status, is_current, checksum_sha256, pipeline_version, created_by)
     VALUES (gen_random_uuid(), $1, $2, $3, 1, 'READY', true, $4, 'e2e-v1', $5)
     RETURNING id`,
    [workspaceId, documentId, storedFileId, 'b'.repeat(64), userId],
  );
  const documentVersionId = verRes.rows[0]!.id;
  await pool.query(`UPDATE documents SET current_version_id = $1 WHERE id = $2`, [
    documentVersionId,
    documentId,
  ]);

  // -- Chunk --
  const chunkContent =
    'The retention period for all records is 7 years per the current policy. The policy applies to all internal documents.';
  const chunkRes = await pool.query<{ id: string }>(
    `INSERT INTO document_chunks (id, workspace_id, document_id, document_version_id, ordinal, content, content_hash, locator, heading_path, chunking_version)
     VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, $5, $6, '{}', 'e2e-v1')
     RETURNING id`,
    [
      workspaceId,
      documentId,
      documentVersionId,
      chunkContent,
      'c'.repeat(64),
      JSON.stringify({
        type: 'paragraph',
        ordinal: 0,
        startOffset: 0,
        endOffset: chunkContent.length,
      }),
    ],
  );
  const chunkId = chunkRes.rows[0]!.id;

  // -- Embedding (fake provider — deterministic, not semantic) --
  // We do not need a real semantic match for the e2e flow; the retrieval
  // service returns lexical matches. The fake embedding ensures the
  // chunk has a vector row so the SQL joins succeed. The vector must
  // match the dimension declared in the column (1536 per migration 004).
  const VECTOR_DIM = 1536;
  const fakeVector = Array.from({ length: VECTOR_DIM }, () => 0.1).join(',');
  await pool.query(
    `INSERT INTO chunk_embeddings (id, workspace_id, chunk_id, embedding_model, embedding_dimensions, embedding_version, embedding)
     VALUES (gen_random_uuid(), $1, $2, 'fake', $3, 'e2e-v1', $4::vector)`,
    [workspaceId, chunkId, VECTOR_DIM, `[${fakeVector}]`],
  );

  return {
    userId,
    workspaceId,
    sourceId,
    documentId,
    documentVersionId,
    chunkId,
    chunkContent,
  };
}

async function disableRls(pool: Pool): Promise<void> {
  const tables = [
    'workspaces',
    'users',
    'sources',
    'stored_files',
    'documents',
    'document_versions',
    'document_chunks',
    'chunk_embeddings',
    'retrieval_configs',
    'retrieval_traces',
    'retrieval_results',
    'conversations',
    'messages',
    'model_runs',
    'citations',
    'feedback',
    'feedback_retrieval_traces',
    'workspace_members',
  ];
  for (const t of tables) {
    try {
      await pool.query(`ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY`);
    } catch {
      // Table may not exist; that's fine for e2e
    }
  }
}

/**
 * Checks whether PostgreSQL is reachable in the current environment.
 * If not, the caller should skip the test with a clear message.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
    await admin.query('SELECT 1');
    await admin.end();
    return true;
  } catch {
    return false;
  }
}
