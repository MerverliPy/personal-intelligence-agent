import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import {
  createSource,
  getSourceById,
  listSources,
  softDeleteSource,
  createStoredFile,
  getStoredFileByKey,
  getStoredFileById,
  createDocument,
  getDocumentById,
  listDocuments,
  softDeleteDocument,
  createDocumentVersion,
  getDocumentVersionById,
  listVersions,
  transitionDocumentVersionStatus,
  setCurrentVersion,
  createIngestionJob,
  getIngestionJobById,
  transitionIngestionJobStatus,
  listPendingJobs,
} from '../src/repositories.js';
import { isRetrievableVersion } from '../src/state-machine.js';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: Pool;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserTableNames(p: Pool): Promise<string[]> {
  const result = await p.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return result.rows.map((r) => r.tablename);
}

async function getEnumTypes(p: Pool): Promise<string[]> {
  const result = await p.query<{ typname: string }>(`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname
  `);
  return result.rows.map((r) => r.typname);
}

async function getColumnNames(p: Pool, table: string): Promise<string[]> {
  const result = await p.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((r) => r.column_name);
}

async function getFkConstraints(p: Pool, table: string): Promise<string[]> {
  const result = await p.query<{ foreign_table_name: string }>(
    `SELECT DISTINCT ccu.table_name AS foreign_table_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = $1
       AND tc.table_schema = 'public'
     ORDER BY ccu.table_name`,
    [table],
  );
  return result.rows.map((r) => r.foreign_table_name);
}

function validChecksum(): string {
  return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
}

function alternativeChecksum(): string {
  return 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
}

// ---------------------------------------------------------------------------
// PART 1: Migration verification
// ---------------------------------------------------------------------------

describe('migration 003: knowledge tables exist', () => {
  it('creates the sources table', async () => {
    const tables = await getUserTableNames(pool);
    expect(tables).toContain('sources');
  });
  it('creates the stored_files table', async () => {
    const tables = await getUserTableNames(pool);
    expect(tables).toContain('stored_files');
  });
  it('creates the documents table', async () => {
    const tables = await getUserTableNames(pool);
    expect(tables).toContain('documents');
  });
  it('creates the document_versions table', async () => {
    const tables = await getUserTableNames(pool);
    expect(tables).toContain('document_versions');
  });
  it('creates the ingestion_jobs table', async () => {
    const tables = await getUserTableNames(pool);
    expect(tables).toContain('ingestion_jobs');
  });
});

describe('migration 003: enums', () => {
  it('creates document_version_status enum', async () => {
    const enums = await getEnumTypes(pool);
    expect(enums).toContain('document_version_status');
  });
  it('creates ingestion_job_status enum', async () => {
    const enums = await getEnumTypes(pool);
    expect(enums).toContain('ingestion_job_status');
  });
});

describe('sources columns', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'sources');
    expect(cols).toContain('id');
    expect(cols).toContain('workspace_id');
    expect(cols).toContain('project_id');
    expect(cols).toContain('source_type');
    expect(cols).toContain('name');
    expect(cols).toContain('authority_rank');
    expect(cols).toContain('sensitivity');
    expect(cols).toContain('configuration');
    expect(cols).toContain('status');
    expect(cols).toContain('created_by');
    expect(cols).toContain('deleted_at');
  });
});

describe('stored_files columns', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'stored_files');
    expect(cols).toContain('workspace_id');
    expect(cols).toContain('storage_provider');
    expect(cols).toContain('object_key');
    expect(cols).toContain('checksum_sha256');
  });
});

describe('document_versions columns', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'document_versions');
    expect(cols).toContain('document_id');
    expect(cols).toContain('stored_file_id');
    expect(cols).toContain('version_number');
    expect(cols).toContain('status');
    expect(cols).toContain('is_current');
    expect(cols).toContain('checksum_sha256');
    expect(cols).toContain('ready_at');
    expect(cols).toContain('superseded_at');
  });
});

describe('ingestion_jobs columns', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'ingestion_jobs');
    expect(cols).toContain('document_version_id');
    expect(cols).toContain('idempotency_key');
    expect(cols).toContain('pipeline_version');
    expect(cols).toContain('status');
    expect(cols).toContain('attempt');
    expect(cols).toContain('max_attempts');
  });
});

describe('foreign keys', () => {
  it('sources references workspaces, projects, users', async () => {
    const fks = await getFkConstraints(pool, 'sources');
    expect(fks).toContain('workspaces');
    expect(fks).toContain('projects');
    expect(fks).toContain('users');
  });
  it('documents references workspaces, document_versions', async () => {
    const fks = await getFkConstraints(pool, 'documents');
    expect(fks).toContain('workspaces');
    expect(fks).toContain('document_versions');
  });
  it('document_versions references workspaces, documents, stored_files', async () => {
    const fks = await getFkConstraints(pool, 'document_versions');
    expect(fks).toContain('workspaces');
    expect(fks).toContain('documents');
    expect(fks).toContain('stored_files');
  });
  it('ingestion_jobs references workspaces, document_versions', async () => {
    const fks = await getFkConstraints(pool, 'ingestion_jobs');
    expect(fks).toContain('workspaces');
    expect(fks).toContain('document_versions');
  });
});

describe('unique constraints', () => {
  it('document_versions has partial unique index for one current READY', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'document_versions_one_current_uq'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
  it('ingestion_jobs has unique (workspace_id, idempotency_key)', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kc
          ON kc.constraint_name = tc.constraint_name
         AND kc.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_name = 'ingestion_jobs'
          AND tc.table_schema = 'public'
          AND kc.column_name IN ('workspace_id', 'idempotency_key')
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});

describe('row-level security', () => {
  it('sources has RLS enabled', async () => {
    const policies = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sources') AS exists`,
    );
    expect(policies.rows[0]?.exists).toBe(true);
  });
  it('stored_files has RLS enabled', async () => {
    const policies = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stored_files') AS exists`,
    );
    expect(policies.rows[0]?.exists).toBe(true);
  });
  it('documents has RLS enabled', async () => {
    const policies = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents') AS exists`,
    );
    expect(policies.rows[0]?.exists).toBe(true);
  });
  it('document_versions has RLS enabled', async () => {
    const policies = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_versions') AS exists`,
    );
    expect(policies.rows[0]?.exists).toBe(true);
  });
  it('ingestion_jobs has RLS enabled', async () => {
    const policies = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingestion_jobs') AS exists`,
    );
    expect(policies.rows[0]?.exists).toBe(true);
  });
});

describe('constraint enforcement', () => {
  it('rejects negative size_bytes on stored_files', async () => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'enforce.${Date.now()}@test.com') RETURNING id`,
    );
    const uid = userResult.rows[0]!.id;
    const wsResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Enforce WS', $1) RETURNING id`,
      [uid],
    );
    const wsid = wsResult.rows[0]!.id;

    await expect(
      pool.query(
        `INSERT INTO stored_files (workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, created_by)
         VALUES ($1, 's3', 'test/neg.txt', 'neg.txt', -1, $2, $3)`,
        [wsid, validChecksum(), uid],
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid checksum_sha256 format', async () => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'checksum.${Date.now()}@test.com') RETURNING id`,
    );
    const uid = userResult.rows[0]!.id;
    const wsResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Checksum WS', $1) RETURNING id`,
      [uid],
    );
    const wsid = wsResult.rows[0]!.id;

    await expect(
      pool.query(
        `INSERT INTO stored_files (workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, created_by)
         VALUES ($1, 's3', 'test/badhash.txt', 'badhash.txt', 100, 'abc123', $2)`,
        [wsid, uid],
      ),
    ).rejects.toThrow();
  });

  it('rejects duplicate version number for same document', async () => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'dupv.${Date.now()}@test.com') RETURNING id`,
    );
    const uid = userResult.rows[0]!.id;
    const wsResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'DupV WS', $1) RETURNING id`,
      [uid],
    );
    const wsid = wsResult.rows[0]!.id;

    // Create stored file with unique key
    const sfResult = await pool.query<{ id: string }>(
      `INSERT INTO stored_files (workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, created_by)
       VALUES ($1, 's3', 'test/dupv.${Date.now()}.txt', 'dupv.txt', 100, $2, $3) RETURNING id`,
      [wsid, validChecksum(), uid],
    );
    const sfid = sfResult.rows[0]!.id;

    const docResult = await pool.query<{ id: string }>(
      `INSERT INTO documents (workspace_id, title, created_by) VALUES ($1, 'DupV Doc', $2) RETURNING id`,
      [wsid, uid],
    );
    const docid = docResult.rows[0]!.id;

    // Create version 1
    await pool.query(
      `INSERT INTO document_versions (workspace_id, document_id, stored_file_id, version_number, checksum_sha256, created_by)
       VALUES ($1, $2, $3, 1, $4, $5)`,
      [wsid, docid, sfid, validChecksum(), uid],
    );

    // Duplicate version_number for same document should fail
    await expect(
      pool.query(
        `INSERT INTO document_versions (workspace_id, document_id, stored_file_id, version_number, checksum_sha256, created_by)
         VALUES ($1, $2, $3, 1, $4, $5)`,
        [wsid, docid, sfid, alternativeChecksum(), uid],
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PART 2: Repository tests
// ---------------------------------------------------------------------------

let uid: string;
let wsid: string;

describe('repository setup', () => {
  it('creates base user and workspace', async () => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'repo.${Date.now()}@test.com') RETURNING id`,
    );
    uid = userResult.rows[0]!.id;

    const wsResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Repo WS', $1) RETURNING id`,
      [uid],
    );
    wsid = wsResult.rows[0]!.id;

    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
      [wsid, uid],
    );
    expect(uid).toBeTruthy();
    expect(wsid).toBeTruthy();
  });
});

describe('source repository', () => {
  it('creates and retrieves a source', async () => {
    const src = await createSource(pool, {
      workspaceId: wsid,
      sourceType: 'upload',
      name: 'Test Source',
      createdBy: uid,
    });
    expect(src.id).toBeTruthy();
    expect(src.name).toBe('Test Source');
    expect(src.sourceType).toBe('upload');
    expect(src.sensitivity).toBe('INTERNAL');
    expect(src.status).toBe('ACTIVE');
    expect(src.workspaceId).toBe(wsid);

    const retrieved = await getSourceById(pool, wsid, src.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Test Source');
  });

  it('returns null for non-existent source', async () => {
    const result = await getSourceById(pool, wsid, '00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('soft-deletes a source', async () => {
    const src = await createSource(pool, {
      workspaceId: wsid,
      sourceType: 'tmp',
      name: 'To Delete',
      createdBy: uid,
    });
    const deleted = await softDeleteSource(pool, wsid, src.id);
    expect(deleted).toBe(true);
    const result = await getSourceById(pool, wsid, src.id);
    expect(result).toBeNull();
  });
});

describe('stored file repository', () => {
  it('creates and retrieves a stored file', async () => {
    const key = `test/file-${Date.now()}.txt`;
    const file = await createStoredFile(pool, {
      workspaceId: wsid,
      storageProvider: 'minio',
      objectKey: key,
      originalFilename: 'file1.txt',
      sizeBytes: 1024,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    expect(file.id).toBeTruthy();
    expect(file.storageProvider).toBe('minio');
    expect(file.sizeBytes).toBe(1024);

    const byKey = await getStoredFileByKey(pool, wsid, 'minio', key);
    expect(byKey).not.toBeNull();
    expect(byKey!.originalFilename).toBe('file1.txt');

    const byId = await getStoredFileById(pool, wsid, file.id);
    expect(byId).not.toBeNull();
  });

  it('rejects negative size_bytes', async () => {
    await expect(
      createStoredFile(pool, {
        workspaceId: wsid,
        storageProvider: 'minio',
        objectKey: `test/neg-${Date.now()}.txt`,
        originalFilename: 'neg.txt',
        sizeBytes: -1,
        checksumSha256: validChecksum(),
        createdBy: uid,
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate (storage_provider, object_key)', async () => {
    const key = `test/dup-key-${Date.now()}.txt`;
    await createStoredFile(pool, {
      workspaceId: wsid,
      storageProvider: 'minio',
      objectKey: key,
      originalFilename: 'dup1.txt',
      sizeBytes: 500,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });

    await expect(
      createStoredFile(pool, {
        workspaceId: wsid,
        storageProvider: 'minio',
        objectKey: key,
        originalFilename: 'dup2.txt',
        sizeBytes: 600,
        checksumSha256: validChecksum(),
        createdBy: uid,
      }),
    ).rejects.toThrow();
  });
});

describe('document repository', () => {
  it('creates and retrieves a document', async () => {
    const doc = await createDocument(pool, {
      workspaceId: wsid,
      title: 'Test Document',
      createdBy: uid,
    });
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe('Test Document');
    expect(doc.sensitivity).toBe('INTERNAL');
    expect(doc.currentVersionId).toBeNull();

    const retrieved = await getDocumentById(pool, wsid, doc.id);
    expect(retrieved).not.toBeNull();
  });

  it('soft-deletes a document', async () => {
    const doc = await createDocument(pool, {
      workspaceId: wsid,
      title: `To Delete ${Date.now()}`,
      createdBy: uid,
    });
    const deleted = await softDeleteDocument(pool, wsid, doc.id);
    expect(deleted).toBe(true);
    const result = await getDocumentById(pool, wsid, doc.id);
    expect(result).toBeNull();
  });
});

describe('document version repository', () => {
  let docId: string;
  let sfId: string;

  beforeAll(async () => {
    const sf = await createStoredFile(pool, {
      workspaceId: wsid,
      storageProvider: 'minio',
      objectKey: `test/version-${Date.now()}.txt`,
      originalFilename: 'version-test.txt',
      sizeBytes: 2048,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    sfId = sf.id;

    const doc = await createDocument(pool, {
      workspaceId: wsid,
      title: 'Version Test Doc',
      createdBy: uid,
    });
    docId = doc.id;
  });

  it('creates version with auto-incremented version_number', async () => {
    const v1 = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: docId,
      storedFileId: sfId,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    expect(v1.versionNumber).toBe(1);
    expect(v1.status).toBe('PENDING_UPLOAD');
  });

  it('rejects illegal status transition', async () => {
    const v = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: docId,
      storedFileId: sfId,
      checksumSha256: alternativeChecksum(),
      createdBy: uid,
    });
    // PENDING_UPLOAD -> READY should fail
    await expect(transitionDocumentVersionStatus(pool, wsid, v.id, 'READY')).rejects.toThrow(
      /Illegal document version state transition/,
    );
  });

  it('transitions through valid statuses to READY', async () => {
    const v = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: docId,
      storedFileId: sfId,
      checksumSha256: alternativeChecksum(),
      createdBy: uid,
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const uploaded = await transitionDocumentVersionStatus(client, wsid, v.id, 'UPLOADED');
      expect(uploaded.status).toBe('UPLOADED');
      const ingesting = await transitionDocumentVersionStatus(client, wsid, v.id, 'INGESTING');
      expect(ingesting.status).toBe('INGESTING');
      const ready = await transitionDocumentVersionStatus(client, wsid, v.id, 'READY');
      expect(ready.status).toBe('READY');
      expect(ready.readyAt).not.toBeNull();
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('sets current version atomically and supersedes old (FR-ING-009)', async () => {
    // Create a dedicated document for this test
    const sf = await createStoredFile(pool, {
      workspaceId: wsid,
      storageProvider: 'minio',
      objectKey: `test/current-${Date.now()}.txt`,
      originalFilename: 'current-test.txt',
      sizeBytes: 100,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    const doc = await createDocument(pool, {
      workspaceId: wsid,
      title: `Current Doc ${Date.now()}`,
      createdBy: uid,
    });

    const v1 = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: doc.id,
      storedFileId: sf.id,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });

    // Transition v1 to READY and set as current
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await transitionDocumentVersionStatus(client, wsid, v1.id, 'UPLOADED');
      await transitionDocumentVersionStatus(client, wsid, v1.id, 'INGESTING');
      await transitionDocumentVersionStatus(client, wsid, v1.id, 'READY');
      await setCurrentVersion(client, wsid, doc.id, v1.id);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // v1 should be current
    const v1After = await getDocumentVersionById(pool, wsid, v1.id);
    expect(v1After!.isCurrent).toBe(true);

    // Create v2, transition to READY, set as current
    const v2 = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: doc.id,
      storedFileId: sf.id,
      checksumSha256: alternativeChecksum(),
      createdBy: uid,
    });

    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      await transitionDocumentVersionStatus(client2, wsid, v2.id, 'UPLOADED');
      await transitionDocumentVersionStatus(client2, wsid, v2.id, 'INGESTING');
      await transitionDocumentVersionStatus(client2, wsid, v2.id, 'READY');
      await setCurrentVersion(client2, wsid, doc.id, v2.id);
      await client2.query('COMMIT');
    } finally {
      client2.release();
    }

    // v1 should be superseded, v2 should be current
    const v1Superseded = await getDocumentVersionById(pool, wsid, v1.id);
    expect(v1Superseded!.isCurrent).toBe(false);
    expect(v1Superseded!.status).toBe('READY');
    expect(v1Superseded!.supersededAt).not.toBeNull();

    const v2Current = await getDocumentVersionById(pool, wsid, v2.id);
    expect(v2Current!.isCurrent).toBe(true);

    const docFinal = await getDocumentById(pool, wsid, doc.id);
    expect(docFinal!.currentVersionId).toBe(v2.id);
  });

  it('rejects setting non-READY version as current', async () => {
    const v = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: docId,
      storedFileId: sfId,
      checksumSha256: alternativeChecksum(),
      createdBy: uid,
    });
    // v is PENDING_UPLOAD — setCurrentVersion should be a no-op
    await setCurrentVersion(pool, wsid, docId, v.id);
    const vAfter = await getDocumentVersionById(pool, wsid, v.id);
    expect(vAfter!.isCurrent).toBe(false);
  });

  it('isRetrievableVersion reflects status', async () => {
    const v = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: docId,
      storedFileId: sfId,
      checksumSha256: alternativeChecksum(),
      createdBy: uid,
    });
    expect(isRetrievableVersion(v.status)).toBe(false);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await transitionDocumentVersionStatus(client, wsid, v.id, 'UPLOADED');
      await transitionDocumentVersionStatus(client, wsid, v.id, 'INGESTING');
      await transitionDocumentVersionStatus(client, wsid, v.id, 'READY');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const vReady = await getDocumentVersionById(pool, wsid, v.id);
    expect(isRetrievableVersion(vReady!.status)).toBe(true);
  });
});

describe('ingestion job repository', () => {
  let versionId: string;

  beforeAll(async () => {
    const sf = await createStoredFile(pool, {
      workspaceId: wsid,
      storageProvider: 'minio',
      objectKey: `test/job-${Date.now()}.txt`,
      originalFilename: 'job-test.txt',
      sizeBytes: 100,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    const doc = await createDocument(pool, {
      workspaceId: wsid,
      title: 'Job Test Doc',
      createdBy: uid,
    });
    const v = await createDocumentVersion(pool, {
      workspaceId: wsid,
      documentId: doc.id,
      storedFileId: sf.id,
      checksumSha256: validChecksum(),
      createdBy: uid,
    });
    versionId = v.id;
  });

  it('creates and retrieves an ingestion job', async () => {
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `ingest-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });
    expect(job.status).toBe('QUEUED');
    expect(job.attempt).toBe(0);
    expect(job.maxAttempts).toBe(5);
  });

  it('rejects duplicate idempotency_key for same workspace', async () => {
    const key = `ingest-dup-${Date.now()}`;
    await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: key,
      pipelineVersion: '1.0.0',
    });
    await expect(
      createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: key,
        pipelineVersion: '1.0.0',
      }),
    ).rejects.toThrow();
  });

  it('transitions through valid states', async () => {
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `ingest-trans-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });
    const running = await transitionIngestionJobStatus(pool, wsid, job.id, 'RUNNING');
    expect(running.status).toBe('RUNNING');
    const succeeded = await transitionIngestionJobStatus(pool, wsid, job.id, 'SUCCEEDED');
    expect(succeeded.status).toBe('SUCCEEDED');
  });

  it('rejects illegal ingestion job transition', async () => {
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `ingest-fail-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });
    await transitionIngestionJobStatus(pool, wsid, job.id, 'RUNNING');
    await transitionIngestionJobStatus(pool, wsid, job.id, 'SUCCEEDED');
    // SUCCEEDED -> RUNNING should fail
    await expect(transitionIngestionJobStatus(pool, wsid, job.id, 'RUNNING')).rejects.toThrow(
      /Illegal ingestion job state transition/,
    );
  });

  it('lists pending jobs', async () => {
    await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `ingest-pending-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });
    const jobs = await listPendingJobs(pool, 50);
    const allQueuedOrRetry = jobs.every((j) => j.status === 'QUEUED' || j.status === 'RETRY_WAIT');
    expect(allQueuedOrRetry).toBe(true);
  });
});
