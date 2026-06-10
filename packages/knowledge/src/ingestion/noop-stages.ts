import type { IngestionStage, StageContext, StageResult } from './types.js';
import { TerminalJobError } from '@pia/jobs';

// ---------------------------------------------------------------------------
// No-op extraction stage
// ---------------------------------------------------------------------------

/**
 * Placeholder extraction stage that creates a minimal extraction metadata
 * record. Replaced by real parsers in P2-T04.
 */
export const noopExtractionStage: IngestionStage = {
  name: 'extraction',

  async isComplete(context: StageContext): Promise<boolean> {
    const meta = context.version.extractionMetadata;
    return (
      meta !== null &&
      typeof meta === 'object' &&
      'pipeline' in meta &&
      meta['pipeline'] === context.job.pipelineVersion
    );
  },

  async execute(context: StageContext): Promise<StageResult> {
    // No-op: record that extraction "happened" at this pipeline version
    const meta = context.version.extractionMetadata ?? {};
    await context.pool.query(
      `UPDATE document_versions
       SET extraction_metadata = $3
       WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [
        context.version.workspaceId,
        context.version.id,
        JSON.stringify({
          ...(meta as Record<string, unknown>),
          pipeline: context.job.pipelineVersion,
        }),
      ],
    );

    return { performed: true, metadata: { pipeline: context.job.pipelineVersion } };
  },
};

// ---------------------------------------------------------------------------
// No-op chunking stage
// ---------------------------------------------------------------------------

/**
 * Creates a single placeholder chunk for the document version to prove
 * the idempotency and checkpointing pipeline. Replaced by real chunking
 * in P2-T05.
 */
export const noopChunkingStage: IngestionStage = {
  name: 'chunking',

  async isComplete(context: StageContext): Promise<boolean> {
    const result = await context.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM document_chunks
       WHERE workspace_id = $1 AND document_version_id = $2`,
      [context.version.workspaceId, context.version.id],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  },

  async execute(context: StageContext): Promise<StageResult> {
    if (await this.isComplete(context)) {
      return { performed: false };
    }

    // Insert a single placeholder chunk. The UNIQUE(document_version_id, ordinal)
    // constraint guarantees idempotency — a duplicate INSERT will fail.
    try {
      await context.pool.query(
        `INSERT INTO document_chunks (
           workspace_id, document_id, document_version_id, ordinal,
           content, content_hash, locator, chunking_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          context.version.workspaceId,
          context.version.documentId,
          context.version.id,
          0,
          `[Placeholder chunk for version ${context.version.id}]`,
          `placeholder-${context.version.id}`,
          JSON.stringify({ type: 'placeholder', page: 1 }),
          `noop-${context.job.pipelineVersion}`,
        ],
      );
    } catch (err: unknown) {
      // If another concurrent execution already inserted the chunk, treat
      // as already complete (idempotent).
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        return { performed: false };
      }
      throw err;
    }

    return { performed: true, metadata: { chunkCount: 1 } };
  },
};

// ---------------------------------------------------------------------------
// No-op embedding stage
// ---------------------------------------------------------------------------

/**
 * Creates a single placeholder embedding for the placeholder chunk to
 * prove idempotency and checkpointing. Replaced by a real embedding
 * gateway in P2-T06.
 */
export const noopEmbeddingStage: IngestionStage = {
  name: 'embedding',

  async isComplete(context: StageContext): Promise<boolean> {
    const result = await context.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chunk_embeddings ce
       JOIN document_chunks dc ON dc.id = ce.chunk_id
       WHERE dc.workspace_id = $1 AND dc.document_version_id = $2`,
      [context.version.workspaceId, context.version.id],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  },

  async execute(context: StageContext): Promise<StageResult> {
    if (await this.isComplete(context)) {
      return { performed: false };
    }

    // Find the placeholder chunk
    const chunkResult = await context.pool.query<{ id: string }>(
      `SELECT id FROM document_chunks
       WHERE workspace_id = $1 AND document_version_id = $2 AND ordinal = 0
       LIMIT 1`,
      [context.version.workspaceId, context.version.id],
    );

    const chunkId = chunkResult.rows[0]?.id;
    if (!chunkId) {
      throw new TerminalJobError('No chunks found for embedding stage', 'INGESTION_NO_CHUNKS');
    }

    // Insert a placeholder zero-vector. The UNIQUE(chunk_id, embedding_model,
    // embedding_version) constraint provides idempotency.
    const model = 'placeholder-model';
    const version = `noop-${context.job.pipelineVersion}`;
    const dimensions = 1536;
    const zeroVec = `[${Array.from({ length: dimensions }, () => '0').join(',')}]`;

    try {
      await context.pool.query(
        `INSERT INTO chunk_embeddings (
           workspace_id, chunk_id, embedding_model, embedding_dimensions,
           embedding_version, embedding
         ) VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [context.version.workspaceId, chunkId, model, dimensions, version, zeroVec],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        return { performed: false };
      }
      throw err;
    }

    return { performed: true, metadata: { model, dimensions, embeddingCount: 1 } };
  },
};
