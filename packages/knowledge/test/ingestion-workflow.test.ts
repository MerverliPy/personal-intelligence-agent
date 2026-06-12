import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { OutboxRecord, JobContext } from '@pia/jobs';
import { TerminalJobError } from '@pia/jobs';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import {
  createSource,
  createStoredFile,
  createDocument,
  createDocumentVersion,
  getDocumentVersionById,
  transitionDocumentVersionStatus,
  setCurrentVersion,
  createIngestionJob,
  getIngestionJobById,
  transitionIngestionJobStatus,
} from '../src/repositories.js';
import { publishingStage } from '../src/ingestion/publishing-stage.js';
import {
  noopExtractionStage,
  noopChunkingStage,
  noopEmbeddingStage,
} from '../src/ingestion/noop-stages.js';
import { IngestionWorkflowHandler } from '../src/ingestion/workflow.js';
import type { IngestionStage } from '../src/ingestion/types.js';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

function requirePool(ctx: { skip: () => void }): asserts pool is Pool {
  if (!pool) ctx.skip();
}

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validChecksum(): string {
  return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
}

async function seedBaseEntities(): Promise<{
  uid: string;
  wsid: string;
  sfid: string;
  docid: string;
}> {
  const userResult = await pool.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'wf.${Date.now()}@test.com') RETURNING id`,
  );
  const uid = userResult.rows[0]!.id;

  const wsResult = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'WF WS', $1) RETURNING id`,
    [uid],
  );
  const wsid = wsResult.rows[0]!.id;

  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [wsid, uid],
  );

  const sf = await createStoredFile(pool, {
    workspaceId: wsid,
    storageProvider: 'minio',
    objectKey: `test/wf-${Date.now()}.txt`,
    originalFilename: 'wf-test.txt',
    sizeBytes: 1024,
    checksumSha256: validChecksum(),
    createdBy: uid,
  });

  const doc = await createDocument(pool, {
    workspaceId: wsid,
    title: `Workflow Doc ${Date.now()}`,
    createdBy: uid,
  });

  return { uid, wsid, sfid: sf.id, docid: doc.id };
}

async function createIngestingVersion(
  wsid: string,
  uid: string,
  docid: string,
  sfid: string,
): Promise<string> {
  const v = await createDocumentVersion(pool, {
    workspaceId: wsid,
    documentId: docid,
    storedFileId: sfid,
    checksumSha256: validChecksum(),
    createdBy: uid,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await transitionDocumentVersionStatus(client, wsid, v.id, 'UPLOADED');
    await transitionDocumentVersionStatus(client, wsid, v.id, 'INGESTING');
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  return v.id;
}

function makeOutboxRecord(
  workspaceId: string,
  aggregateId: string,
  versionId: string,
): OutboxRecord {
  return {
    id: aggregateId,
    workspaceId,
    aggregateType: 'ingestion',
    aggregateId,
    eventType: 'document.ingestion.requested',
    schemaVersion: 1,
    payload: { documentVersionId: versionId },
    status: 'PENDING',
    attempt: 0,
    availableAt: new Date(),
    publishedAt: null,
    createdAt: new Date(),
  };
}

function makeJobContext(correlationId: string, attempt: number): JobContext {
  return {
    correlationId,
    attempt,
    workerIdentity: 'test-worker',
    startedAt: new Date(),
  };
}

/** No-op logger that satisfies the Logger interface for tests. */
function noopLogger(): import('@pia/observability').Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  } as unknown as import('@pia/observability').Logger;
}

// ---------------------------------------------------------------------------
// Publishing stage tests
// ---------------------------------------------------------------------------

describe('publishingStage', () => {
  let wsid: string;
  let docid: string;
  let sfid: string;
  let uid: string;

  beforeEach(async (ctx) => {
    requirePool(ctx);
    const entities = await seedBaseEntities();
    wsid = entities.wsid;
    docid = entities.docid;
    sfid = entities.sfid;
    uid = entities.uid;
  });

  it('transitions version to READY and sets as current atomically', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `pub-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    const result = await publishingStage.execute({
      pool,
      version,
      job,
      correlationId: 'test-correlation',
    });

    expect(result.performed).toBe(true);

    const versionAfter = await getDocumentVersionById(pool, wsid, versionId);
    expect(versionAfter!.status).toBe('READY');
    expect(versionAfter!.isCurrent).toBe(true);
    expect(versionAfter!.readyAt).not.toBeNull();
  });

  it('is idempotent — returns performed:false when already READY', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `pub-idem-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // First execution
    await publishingStage.execute({ pool, version, job, correlationId: 'c1' });

    // Refresh version
    const versionReady = (await getDocumentVersionById(pool, wsid, versionId))!;

    // Second execution — should be no-op
    const result2 = await publishingStage.execute({
      pool,
      version: versionReady,
      job,
      correlationId: 'c2',
    });

    expect(result2.performed).toBe(false);
  });

  it('isComplete returns true when READY', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `pub-complete-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Not complete initially
    expect(await publishingStage.isComplete({ pool, version, job, correlationId: 'c1' })).toBe(
      false,
    );

    // Execute
    await publishingStage.execute({ pool, version, job, correlationId: 'c1' });

    // Now complete
    const versionReady = (await getDocumentVersionById(pool, wsid, versionId))!;
    expect(
      await publishingStage.isComplete({ pool, version: versionReady, job, correlationId: 'c2' }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No-op stage tests
// ---------------------------------------------------------------------------

describe('noop stages', () => {
  let wsid: string;
  let docid: string;
  let sfid: string;
  let uid: string;

  beforeEach(async (ctx) => {
    requirePool(ctx);
    const entities = await seedBaseEntities();
    wsid = entities.wsid;
    docid = entities.docid;
    sfid = entities.sfid;
    uid = entities.uid;
  });

  describe('noopExtractionStage', () => {
    it('updates extraction_metadata', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `ext-${Date.now()}`,
        pipelineVersion: '1.2.3',
      });

      const result = await noopExtractionStage.execute({
        pool,
        version,
        job,
        correlationId: 'c1',
      });

      expect(result.performed).toBe(true);
      expect(result.metadata).toEqual({ pipeline: '1.2.3' });

      // isComplete should now be true
      const versionAfter = (await getDocumentVersionById(pool, wsid, versionId))!;
      expect(
        await noopExtractionStage.isComplete({
          pool,
          version: versionAfter,
          job,
          correlationId: 'c1',
        }),
      ).toBe(true);
    });

    it('is idempotent on re-execution', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `ext-idem-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      await noopExtractionStage.execute({ pool, version, job, correlationId: 'c1' });
      const versionAfter = (await getDocumentVersionById(pool, wsid, versionId))!;
      const result2 = await noopExtractionStage.execute({
        pool,
        version: versionAfter,
        job,
        correlationId: 'c1',
      });

      // Second call should still set metadata (it overwrites)
      expect(result2.performed).toBe(true);
    });
  });

  describe('noopChunkingStage', () => {
    it('creates a placeholder chunk', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `chk-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      const result = await noopChunkingStage.execute({
        pool,
        version,
        job,
        correlationId: 'c1',
      });

      expect(result.performed).toBe(true);

      // isComplete should be true
      const versionAfter = (await getDocumentVersionById(pool, wsid, versionId))!;
      expect(
        await noopChunkingStage.isComplete({
          pool,
          version: versionAfter,
          job,
          correlationId: 'c1',
        }),
      ).toBe(true);
    });

    it('is idempotent — duplicate execution is no-op', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `chk-idem-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      await noopChunkingStage.execute({ pool, version, job, correlationId: 'c1' });

      const versionAfter = (await getDocumentVersionById(pool, wsid, versionId))!;
      const result2 = await noopChunkingStage.execute({
        pool,
        version: versionAfter,
        job,
        correlationId: 'c1',
      });

      // Second call should report performed:false (isComplete checked first)
      expect(result2.performed).toBe(false);
    });
  });

  describe('noopEmbeddingStage', () => {
    it('creates a placeholder embedding', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `emb-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      // Need a chunk first
      await noopChunkingStage.execute({ pool, version, job, correlationId: 'c1' });

      const versionAfterChunk = (await getDocumentVersionById(pool, wsid, versionId))!;
      const result = await noopEmbeddingStage.execute({
        pool,
        version: versionAfterChunk,
        job,
        correlationId: 'c2',
      });

      expect(result.performed).toBe(true);
    });

    it('throws TerminalJobError when no chunks exist', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `emb-nochunk-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      await expect(
        noopEmbeddingStage.execute({ pool, version, job, correlationId: 'c1' }),
      ).rejects.toThrow(TerminalJobError);
    });

    it('is idempotent on re-execution', async (ctx) => {
      requirePool(ctx);
      const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
      const version = (await getDocumentVersionById(pool, wsid, versionId))!;
      const job = await createIngestionJob(pool, {
        workspaceId: wsid,
        documentVersionId: versionId,
        idempotencyKey: `emb-idem-${Date.now()}`,
        pipelineVersion: '1.0.0',
      });

      await noopChunkingStage.execute({ pool, version, job, correlationId: 'c1' });
      const vAfterChunk = (await getDocumentVersionById(pool, wsid, versionId))!;
      await noopEmbeddingStage.execute({ pool, version: vAfterChunk, job, correlationId: 'c2' });

      const vAfterEmb = (await getDocumentVersionById(pool, wsid, versionId))!;
      const result2 = await noopEmbeddingStage.execute({
        pool,
        version: vAfterEmb,
        job,
        correlationId: 'c2',
      });

      expect(result2.performed).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Workflow handler integration tests
// ---------------------------------------------------------------------------

describe('IngestionWorkflowHandler', () => {
  let wsid: string;
  let docid: string;
  let sfid: string;
  let uid: string;

  beforeEach(async (ctx) => {
    requirePool(ctx);
    const entities = await seedBaseEntities();
    wsid = entities.wsid;
    docid = entities.docid;
    sfid = entities.sfid;
    uid = entities.uid;
  });

  it('completes full pipeline and marks version READY', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `full-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    const record = makeOutboxRecord(wsid, job.id, versionId);
    const context = makeJobContext(`corr-${Date.now()}`, 1);

    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
      stages: {
        extraction: noopExtractionStage,
        chunking: noopChunkingStage,
        embedding: noopEmbeddingStage,
      },
    });

    await handler.handle(record, context);

    // Verify version is READY and current
    const version = await getDocumentVersionById(pool, wsid, versionId);
    expect(version!.status).toBe('READY');
    expect(version!.isCurrent).toBe(true);

    // Verify job is SUCCEEDED
    const jobAfter = await getIngestionJobById(pool, wsid, job.id);
    expect(jobAfter!.status).toBe('SUCCEEDED');
    expect(jobAfter!.stage).toBe('publishing');
  });

  it('is idempotent — re-running the handler does not duplicate artefacts', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `idem-wf-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    const record = makeOutboxRecord(wsid, job.id, versionId);
    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
      stages: {
        extraction: noopExtractionStage,
        chunking: noopChunkingStage,
        embedding: noopEmbeddingStage,
      },
    });

    // First run
    await handler.handle(record, makeJobContext('c1', 1));

    // Verify 1 chunk, 1 embedding
    const chunkCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM document_chunks WHERE document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(chunkCount.rows[0]!.count, 10)).toBe(1);

    const embCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(embCount.rows[0]!.count, 10)).toBe(1);

    // Second run — job already SUCCEEDED, version already READY. The handler
    // exits early because version.status !== 'INGESTING'.
    // Reset the job status for a realistic re-delivery scenario
    await pool.query(`UPDATE ingestion_jobs SET status = 'QUEUED', stage = NULL WHERE id = $1`, [
      job.id,
    ]);

    await handler.handle(record, makeJobContext('c2', 2));

    // Still 1 chunk, 1 embedding
    const chunkCount2 = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM document_chunks WHERE document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(chunkCount2.rows[0]!.count, 10)).toBe(1);

    const embCount2 = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(embCount2.rows[0]!.count, 10)).toBe(1);
  });

  it('handles missing versionId in payload', async (ctx) => {
    requirePool(ctx);
    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
    });

    const record: OutboxRecord = {
      id: 'test-id',
      workspaceId: wsid,
      aggregateType: 'ingestion',
      aggregateId: 'test-id',
      eventType: 'document.ingestion.requested',
      schemaVersion: 1,
      payload: {},
      status: 'PENDING',
      attempt: 0,
      availableAt: new Date(),
      publishedAt: null,
      createdAt: new Date(),
    };

    await expect(handler.handle(record, makeJobContext('c1', 1))).rejects.toThrow(TerminalJobError);
  });

  it('handles non-existent job gracefully', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
    });

    const record = makeOutboxRecord(wsid, '00000000-0000-0000-0000-000000000000', versionId);

    await expect(handler.handle(record, makeJobContext('c1', 1))).rejects.toThrow(TerminalJobError);
  });

  it('skips when version is not in INGESTING state', async (ctx) => {
    requirePool(ctx);
    // Create a version that's already READY
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `skip-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Move version to READY
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await transitionDocumentVersionStatus(client, wsid, versionId, 'READY');
      await setCurrentVersion(client, wsid, version.documentId, versionId);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const record = makeOutboxRecord(wsid, job.id, versionId);
    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
    });

    // Should not throw — just mark job SUCCEEDED
    await handler.handle(record, makeJobContext('c1', 1));

    const jobAfter = await getIngestionJobById(pool, wsid, job.id);
    expect(jobAfter!.status).toBe('SUCCEEDED');
  });

  it('failing stage never marks version READY', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `fail-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Create a failing stage
    const failingStage: IngestionStage = {
      name: 'extraction',
      async isComplete() {
        return false;
      },
      async execute() {
        throw new Error('Simulated extraction failure');
      },
    };

    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
      stages: {
        extraction: failingStage,
        chunking: noopChunkingStage,
        embedding: noopEmbeddingStage,
      },
    });

    const record = makeOutboxRecord(wsid, job.id, versionId);

    // Should throw (transient error)
    await expect(handler.handle(record, makeJobContext('c1', 1))).rejects.toThrow(
      'Simulated extraction failure',
    );

    // Version must NOT be READY
    const version = await getDocumentVersionById(pool, wsid, versionId);
    expect(version!.status).not.toBe('READY');
    expect(version!.status).toBe('INGESTING');
    expect(version!.isCurrent).toBe(false);

    // Job should be in RETRY_WAIT
    const jobAfter = await getIngestionJobById(pool, wsid, job.id);
    expect(jobAfter!.status).toBe('RETRY_WAIT');
    expect(jobAfter!.errorCode).toBe('INGESTION_STAGE_ERROR');
  });

  it('terminal error transitions job to FAILED_FINAL', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `term-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Create a stage that throws TerminalJobError
    const terminalStage: IngestionStage = {
      name: 'extraction',
      async isComplete() {
        return false;
      },
      async execute() {
        throw new TerminalJobError('Unrecoverable', 'EXTRACT_UNRECOVERABLE');
      },
    };

    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
      stages: {
        extraction: terminalStage,
        chunking: noopChunkingStage,
        embedding: noopEmbeddingStage,
      },
    });

    const record = makeOutboxRecord(wsid, job.id, versionId);

    await expect(handler.handle(record, makeJobContext('c1', 1))).rejects.toThrow(TerminalJobError);

    // Version must NOT be READY
    const version = await getDocumentVersionById(pool, wsid, versionId);
    expect(version!.status).not.toBe('READY');

    // Job should be FAILED_FINAL
    const jobAfter = await getIngestionJobById(pool, wsid, job.id);
    expect(jobAfter!.status).toBe('FAILED_FINAL');
    expect(jobAfter!.errorCode).toBe('EXTRACT_UNRECOVERABLE');
  });

  it('resumes from checkpoint after simulated interruption', async (ctx) => {
    requirePool(ctx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `resume-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Simulate: extraction and chunking completed, then crash
    await pool.query(
      `UPDATE ingestion_jobs SET stage = 'chunking', status = 'RUNNING' WHERE id = $1`,
      [job.id],
    );

    // Also create the chunk so chunking stage sees it as complete
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    await noopExtractionStage.execute({
      pool,
      version,
      job,
      correlationId: 'pre-run',
    });
    const vAfterExt = (await getDocumentVersionById(pool, wsid, versionId))!;
    await noopChunkingStage.execute({
      pool,
      version: vAfterExt,
      job,
      correlationId: 'pre-run',
    });

    const record = makeOutboxRecord(wsid, job.id, versionId);
    const handler = new IngestionWorkflowHandler({
      pool,
      logger: noopLogger(),
      stages: {
        extraction: noopExtractionStage,
        chunking: noopChunkingStage,
        embedding: noopEmbeddingStage,
      },
    });

    // Resume — should skip extraction and chunking, run embedding + publishing
    await handler.handle(record, makeJobContext('c1', 2));

    const versionAfter = await getDocumentVersionById(pool, wsid, versionId);
    expect(versionAfter!.status).toBe('READY');
    expect(versionAfter!.isCurrent).toBe(true);

    const jobAfter = await getIngestionJobById(pool, wsid, job.id);
    expect(jobAfter!.status).toBe('SUCCEEDED');
  });
});
