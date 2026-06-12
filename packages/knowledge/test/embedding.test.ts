// ---------------------------------------------------------------------------
// Embedding stage integration tests — requires PostgreSQL
// ---------------------------------------------------------------------------
// Tests for the createEmbeddingStage IngestionStage factory with a real
// database. The fake provider is used for deterministic vectors.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { TerminalJobError } from '@pia/jobs';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import {
  createStoredFile,
  createDocument,
  createDocumentVersion,
  getDocumentVersionById,
  transitionDocumentVersionStatus,
  createIngestionJob,
} from '../src/repositories.js';
import { noopChunkingStage } from '../src/ingestion/noop-stages.js';
import { fakeEmbeddingProvider, defaultFakeModelConfig } from '../src/embeddings/fake-provider.js';
import { createEmbeddingStage } from '../src/embeddings/embedding-stage.js';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../src/embeddings/types.js';

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
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'emb.${Date.now()}@test.com') RETURNING id`,
  );
  const uid = userResult.rows[0]!.id;

  const wsResult = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Emb WS', $1) RETURNING id`,
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
    objectKey: `test/emb-${Date.now()}.txt`,
    originalFilename: 'emb-test.txt',
    sizeBytes: 1024,
    checksumSha256: validChecksum(),
    createdBy: uid,
  });

  const doc = await createDocument(pool, {
    workspaceId: wsid,
    title: `Embedding Doc ${Date.now()}`,
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

// ---------------------------------------------------------------------------
// Embedding stage integration tests
// ---------------------------------------------------------------------------

describe('EmbeddingStage', () => {
  let wsid: string;
  let docid: string;
  let sfid: string;
  let uid: string;

  beforeEach(async (vtCtx) => {
    requirePool(vtCtx);
    const entities = await seedBaseEntities();
    wsid = entities.wsid;
    docid = entities.docid;
    sfid = entities.sfid;
    uid = entities.uid;
  });

  it('creates embeddings for all chunks', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-all-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Create chunks first via noop stage
    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const modelConfig = defaultFakeModelConfig();
    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
    });

    const ctx = { pool, version, job, correlationId: 'emb-1' };
    const result = await stage.execute(ctx);

    expect(result.performed).toBe(true);
    expect(result.metadata).toMatchObject({
      model: modelConfig.model,
      dimensions: modelConfig.dimensions,
      version: modelConfig.version,
    });

    // Verify embeddings were persisted
    const embResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1
         AND ce.embedding_model = $2
         AND ce.embedding_version = $3`,
      [versionId, modelConfig.model, modelConfig.version],
    );
    expect(parseInt(embResult.rows[0]!.count, 10)).toBeGreaterThan(0);
  });

  it('is idempotent — re-execution does not create duplicate embeddings', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-idem-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const modelConfig = defaultFakeModelConfig();
    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
    });

    const ctx = { pool, version, job, correlationId: 'emb-1' };

    // First execution
    const result1 = await stage.execute(ctx);
    expect(result1.performed).toBe(true);

    // Count embeddings after first execution
    const count1 = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    const firstCount = parseInt(count1.rows[0]!.count, 10);
    expect(firstCount).toBeGreaterThan(0);

    // Second execution — should be no-op
    const result2 = await stage.execute(ctx);
    expect(result2.performed).toBe(false);

    // Count should be the same
    const count2 = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(count2.rows[0]!.count, 10)).toBe(firstCount);
  });

  it('isComplete returns false when no embeddings exist', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-comp-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig: defaultFakeModelConfig(),
    });

    const ctx = { pool, version, job, correlationId: 'emb-comp' };
    expect(await stage.isComplete(ctx)).toBe(false);
  });

  it('isComplete returns true after embeddings are created', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-comp2-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const modelConfig = defaultFakeModelConfig();
    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
    });

    const ctx = { pool, version, job, correlationId: 'emb-comp2' };

    // Execute embedding
    await stage.execute(ctx);

    // Now should be complete
    expect(await stage.isComplete(ctx)).toBe(true);
  });

  it('throws TerminalJobError when no chunks exist', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-nochunk-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig: defaultFakeModelConfig(),
    });

    const ctx = { pool, version, job, correlationId: 'emb-nochunk' };

    await expect(stage.execute(ctx)).rejects.toThrow(TerminalJobError);
  });

  it('handles multiple chunks with batching', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-batch-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Insert multiple chunks directly
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `INSERT INTO document_chunks (
           workspace_id, document_id, document_version_id, ordinal,
           content, content_hash, locator, chunking_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          wsid,
          docid,
          versionId,
          i,
          `Chunk content number ${i} with some text for embedding.`,
          `hash-${i}-${Date.now()}`,
          JSON.stringify({ type: 'paragraph', page: 1, offset: i * 100 }),
          'test-v1',
        ],
      );
    }

    const modelConfig = defaultFakeModelConfig();
    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
      batchSize: 2, // Small batch to test batching
    });

    const ctx = { pool, version, job, correlationId: 'emb-batch' };
    const result = await stage.execute(ctx);

    expect(result.performed).toBe(true);

    // All 5 chunks should have embeddings
    const embResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(embResult.rows[0]!.count, 10)).toBe(5);
  });

  it('persists embedding model, dimension, and version metadata', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-meta-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const modelConfig = { ...defaultFakeModelConfig(), version: '2.0-test' };
    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
    });

    const ctx = { pool, version, job, correlationId: 'emb-meta' };
    await stage.execute(ctx);

    // Verify metadata
    const embResult = await pool.query<{
      embedding_model: string;
      embedding_dimensions: number;
      embedding_version: string;
    }>(
      `SELECT ce.embedding_model, ce.embedding_dimensions, ce.embedding_version
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1
       LIMIT 1`,
      [versionId],
    );

    expect(embResult.rows[0]!.embedding_model).toBe(modelConfig.model);
    expect(embResult.rows[0]!.embedding_dimensions).toBe(modelConfig.dimensions);
    expect(embResult.rows[0]!.embedding_version).toBe('2.0-test');
  });

  it('isolates embeddings by model version — different versions create separate embeddings', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-iso-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    const ctx = { pool, version, job, correlationId: 'emb-iso' };

    // First embedding with version v1
    const stageV1 = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig: { ...defaultFakeModelConfig(), version: 'v1' },
    });
    await stageV1.execute(ctx);

    // Second embedding with version v2 (should create separate embeddings)
    const stageV2 = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig: { ...defaultFakeModelConfig(), version: 'v2' },
    });
    await stageV2.execute(ctx);

    // Each chunk should have 2 embeddings (one per version)
    const chunkCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM document_chunks WHERE document_version_id = $1`,
      [versionId],
    );
    const chunkN = parseInt(chunkCount.rows[0]!.count, 10);

    const embCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    const embN = parseInt(embCount.rows[0]!.count, 10);

    expect(embN).toBe(chunkN * 2);
  });

  it('propagates provider errors (transient)', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-err-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    // Provider that throws on every call
    const failingProvider: EmbeddingProvider = {
      async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
        throw new Error('Simulated provider error');
      },
    };

    const stage = createEmbeddingStage({
      pool,
      provider: failingProvider,
      modelConfig: defaultFakeModelConfig(),
    });

    const ctx = { pool, version, job, correlationId: 'emb-err' };

    // Should propagate the error (not wrap in TerminalJobError)
    await expect(stage.execute(ctx)).rejects.toThrow('Simulated provider error');
  });

  it('throws TerminalJobError on dimension mismatch', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-dim-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    await noopChunkingStage.execute({ pool, version, job, correlationId: 'pre-emb' });

    // Provider that returns wrong dimension
    const wrongDimProvider: EmbeddingProvider = {
      async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        return {
          model: request.model,
          results: request.inputs.map((input) => ({
            index: input.index,
            vector: new Array(100).fill(0), // Wrong dimensions
          })),
        };
      },
    };

    const stage = createEmbeddingStage({
      pool,
      provider: wrongDimProvider,
      modelConfig: defaultFakeModelConfig(), // expects 1536
    });

    const ctx = { pool, version, job, correlationId: 'emb-dim' };

    await expect(stage.execute(ctx)).rejects.toThrow(TerminalJobError);
  });

  it('handles chunk that is already embedded (partial idempotency within batch)', async (vtCtx) => {
    requirePool(vtCtx);
    const versionId = await createIngestingVersion(wsid, uid, docid, sfid);
    const version = (await getDocumentVersionById(pool, wsid, versionId))!;
    const job = await createIngestionJob(pool, {
      workspaceId: wsid,
      documentVersionId: versionId,
      idempotencyKey: `emb-partial-${Date.now()}`,
      pipelineVersion: '1.0.0',
    });

    // Insert 3 chunks
    for (let i = 0; i < 3; i++) {
      await pool.query(
        `INSERT INTO document_chunks (
           workspace_id, document_id, document_version_id, ordinal,
           content, content_hash, locator, chunking_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          wsid,
          docid,
          versionId,
          i,
          `Partial test chunk ${i}`,
          `hash-partial-${i}-${Date.now()}`,
          JSON.stringify({ type: 'paragraph', page: 1, offset: i * 100 }),
          'test-v1',
        ],
      );
    }

    // Pre-embed chunk ordinal 1 using INSERT directly
    const chunk1 = await pool.query<{ id: string }>(
      `SELECT id FROM document_chunks WHERE document_version_id = $1 AND ordinal = 1`,
      [versionId],
    );
    const modelConfig = defaultFakeModelConfig();
    const vector = `[${Array.from({ length: 1536 }, () => '0').join(',')}]`;
    await pool.query(
      `INSERT INTO chunk_embeddings (
         workspace_id, chunk_id, embedding_model, embedding_dimensions,
         embedding_version, embedding
       ) VALUES ($1, $2, $3, $4, $5, $6::vector)`,
      [
        wsid,
        chunk1.rows[0]!.id,
        modelConfig.model,
        modelConfig.dimensions,
        modelConfig.version,
        vector,
      ],
    );

    const stage = createEmbeddingStage({
      pool,
      provider: fakeEmbeddingProvider,
      modelConfig,
      batchSize: 2,
    });

    const ctx = { pool, version, job, correlationId: 'emb-partial' };
    const result = await stage.execute(ctx);

    expect(result.performed).toBe(true);

    // Should have exactly 3 embeddings total (1 pre-existing, 2 new)
    const embCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.document_version_id = $1`,
      [versionId],
    );
    expect(parseInt(embCount.rows[0]!.count, 10)).toBe(3);
  });
});
