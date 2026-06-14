// ---------------------------------------------------------------------------
// Security test helpers — fresh test DB + multi-tenant fixture seeding (P3-T10)
// ---------------------------------------------------------------------------
// Mirrors the e2e helper but seeds TWO workspaces (alpha + other) so the
// security tests can assert cross-tenant isolation guarantees.
// ---------------------------------------------------------------------------

import { Pool } from 'pg';
import { runMigrations, defaultMigrationsDir } from '@pia/db';

const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, '/postgres') ??
  'postgresql://pia:pia-dev@localhost:5432/postgres';

const TEST_DB_NAME = 'pia_security_test';

const TEST_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`) ??
  `postgresql://pia:pia-dev@localhost:5432/${TEST_DB_NAME}`;

let testPool: Pool | undefined;

export async function setupSecurityDatabase(): Promise<Pool> {
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

export async function teardownSecurityDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
  }
}

export { TEST_DATABASE_URL };

// ---------------------------------------------------------------------------
// Security fixture registry
// ---------------------------------------------------------------------------

export interface SecurityFixtureRegistry {
  userId: string;
  workspaceId: string;
  /** Other workspace for cross-tenant tests. */
  otherUserId: string;
  otherWorkspaceId: string;
  sourceId: string;
  documentId: string;
  documentVersionId: string;
  chunkId: string;
  /** Chunk in the OTHER workspace. */
  otherChunkId: string;
  /** Document version in the OTHER workspace. */
  otherDocumentVersionId: string;
  chunkContent: string;
}

/**
 * Seeds the security test database with two workspaces, each with a
 * user, source, document, version, and chunk. Returns IDs for the test
 * to consume.
 *
 * RLS is disabled at the test-database level (the security tests assert
 * workspace isolation via the application-layer and verifier checks, not
 * via Postgres RLS).
 */
export async function seedSecurityFixtures(pool: Pool): Promise<SecurityFixtureRegistry> {
  await disableRls(pool);

  // -- User alpha --
  const userRes = await pool.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'sec-user-alpha@test.com') RETURNING id`,
  );
  const userId = userRes.rows[0]!.id;

  // -- User other --
  const user2Res = await pool.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'sec-user-other@test.com') RETURNING id`,
  );
  const otherUserId = user2Res.rows[0]!.id;

  // -- Workspace alpha --
  const wsRes = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'sec-alpha', $1) RETURNING id`,
    [userId],
  );
  const workspaceId = wsRes.rows[0]!.id;
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [workspaceId, userId],
  );

  // -- Workspace other --
  const ws2Res = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'sec-other', $1) RETURNING id`,
    [otherUserId],
  );
  const otherWorkspaceId = ws2Res.rows[0]!.id;
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [otherWorkspaceId, otherUserId],
  );

  // -- Source in alpha --
  const srcRes = await pool.query<{ id: string }>(
    `INSERT INTO sources (id, workspace_id, name, source_type, created_by)
     VALUES (gen_random_uuid(), $1, 'sec-source', 'manual_upload', $2)
     RETURNING id`,
    [workspaceId, userId],
  );
  const sourceId = srcRes.rows[0]!.id;

  // -- Stored file in alpha --
  const sfRes = await pool.query<{ id: string }>(
    `INSERT INTO stored_files (id, workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, scan_status, created_by)
     VALUES (gen_random_uuid(), $1, 'minio', 'sec/uploaded.txt', 'uploaded.txt', 1024, $2, 'CLEAN', $3)
     RETURNING id`,
    [workspaceId, 'a'.repeat(64), userId],
  );
  const storedFileId = sfRes.rows[0]!.id;

  // -- Document in alpha --
  const docRes = await pool.query<{ id: string }>(
    `INSERT INTO documents (id, workspace_id, source_id, title, sensitivity, created_by)
     VALUES (gen_random_uuid(), $1, $2, 'Alpha Document', 'INTERNAL', $3)
     RETURNING id`,
    [workspaceId, sourceId, userId],
  );
  const documentId = docRes.rows[0]!.id;

  // -- Version in alpha (READY, current) --
  const verRes = await pool.query<{ id: string }>(
    `INSERT INTO document_versions (id, workspace_id, document_id, stored_file_id, version_number, status, is_current, checksum_sha256, pipeline_version, created_by)
     VALUES (gen_random_uuid(), $1, $2, $3, 1, 'READY', true, $4, 'sec-v1', $5)
     RETURNING id`,
    [workspaceId, documentId, storedFileId, 'b'.repeat(64), userId],
  );
  const documentVersionId = verRes.rows[0]!.id;
  await pool.query(`UPDATE documents SET current_version_id = $1 WHERE id = $2`, [
    documentVersionId,
    documentId,
  ]);

  // -- Chunk in alpha --
  const chunkContent = 'The alpha workspace document content. Retention is 7 years.';
  const chunkRes = await pool.query<{ id: string }>(
    `INSERT INTO document_chunks (id, workspace_id, document_id, document_version_id, ordinal, content, content_hash, locator, heading_path, chunking_version)
     VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, $5, $6, '{}', 'sec-v1')
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

  // -- Now seed a document in the OTHER workspace with a chunk --
  const sf2Res = await pool.query<{ id: string }>(
    `INSERT INTO stored_files (id, workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, scan_status, created_by)
     VALUES (gen_random_uuid(), $1, 'minio', 'sec/other.txt', 'other.txt', 1024, $2, 'CLEAN', $3)
     RETURNING id`,
    [otherWorkspaceId, 'd'.repeat(64), otherUserId],
  );
  const sf2Id = sf2Res.rows[0]!.id;

  const doc2Res = await pool.query<{ id: string }>(
    `INSERT INTO documents (id, workspace_id, title, sensitivity, created_by)
     VALUES (gen_random_uuid(), $1, 'Other Document', 'CONFIDENTIAL', $2)
     RETURNING id`,
    [otherWorkspaceId, otherUserId],
  );
  const doc2Id = doc2Res.rows[0]!.id;

  const ver2Res = await pool.query<{ id: string }>(
    `INSERT INTO document_versions (id, workspace_id, document_id, stored_file_id, version_number, status, is_current, checksum_sha256, pipeline_version, created_by)
     VALUES (gen_random_uuid(), $1, $2, $3, 1, 'READY', true, $4, 'sec-v1', $5)
     RETURNING id`,
    [otherWorkspaceId, doc2Id, sf2Id, 'e'.repeat(64), otherUserId],
  );
  const otherDocumentVersionId = ver2Res.rows[0]!.id;
  await pool.query(`UPDATE documents SET current_version_id = $1 WHERE id = $2`, [
    otherDocumentVersionId,
    doc2Id,
  ]);

  const otherContent = 'The other workspace confidential content.';
  const chunk2Res = await pool.query<{ id: string }>(
    `INSERT INTO document_chunks (id, workspace_id, document_id, document_version_id, ordinal, content, content_hash, locator, heading_path, chunking_version)
     VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, $5, $6, '{}', 'sec-v1')
     RETURNING id`,
    [
      otherWorkspaceId,
      doc2Id,
      otherDocumentVersionId,
      otherContent,
      'f'.repeat(64),
      JSON.stringify({
        type: 'paragraph',
        ordinal: 0,
        startOffset: 0,
        endOffset: otherContent.length,
      }),
    ],
  );
  const otherChunkId = chunk2Res.rows[0]!.id;

  return {
    userId,
    workspaceId,
    otherUserId,
    otherWorkspaceId,
    sourceId,
    documentId,
    documentVersionId,
    chunkId,
    otherChunkId,
    otherDocumentVersionId,
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
      // Table may not exist; that's fine for security tests
    }
  }
}

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
