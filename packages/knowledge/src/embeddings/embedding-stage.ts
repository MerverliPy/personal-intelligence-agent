// ---------------------------------------------------------------------------
// Embedding stage — IngestionStage that generates and persists chunk embeddings
// ---------------------------------------------------------------------------
// Replaces `noopEmbeddingStage`. Uses an EmbeddingProvider to generate
// vectors for all chunks of a document version and persists them to the
// `chunk_embeddings` table with full model/dimension/version metadata.
//
// ## Idempotency
//
//   - `isComplete()` checks whether every chunk for the version already has
//     an embedding for the configured model+version.
//   - `execute()` uses INSERT with the UNIQUE(chunk_id, embedding_model,
//     embedding_version) constraint to prevent duplicate artefacts.
//   - Duplicate key violations from concurrent execution are caught and
//     treated as already-complete for that chunk.
//
// ## Batching
//
//   Chunks are sent to the provider in configurable batches to respect
//   provider rate limits and optimize throughput. Individual batch failures
//   bubble up as transient errors (triggering job retry); a batch that
//   partially succeeded on a prior attempt is handled via idempotency.
//
// ## Error classification
//
//   - Transient errors (network, rate-limit, timeout) are re-thrown so
//     the workflow orchestrator can retry the job.
//   - The stage itself throws TerminalJobError only for non-retryable
//     conditions (no chunks found, all chunks already embedded, dimension
//     mismatch).
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { IngestionStage, StageContext, StageResult } from '../ingestion/types.js';
import { TerminalJobError } from '@pia/jobs';
import type { EmbeddingProvider, EmbeddingModelConfig } from './types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Options for constructing an embedding stage.
 */
export interface CreateEmbeddingStageOptions {
  /** Database pool for chunk/embedding queries. */
  pool: Pool;
  /** Embedding provider (fake or real). */
  provider: EmbeddingProvider;
  /** Model configuration persisted alongside each embedding. */
  modelConfig: EmbeddingModelConfig;
  /** Maximum number of chunks to send per provider request. */
  batchSize?: number;
}

/** Default batch size when not specified. */
const DEFAULT_BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Stage factory
// ---------------------------------------------------------------------------

/**
 * Creates the real embedding stage for the ingestion pipeline.
 */
export function createEmbeddingStage(options: CreateEmbeddingStageOptions): IngestionStage {
  const { provider, modelConfig, batchSize = DEFAULT_BATCH_SIZE } = options;
  const { model: embeddingModel, dimensions, version: embeddingVersion } = modelConfig;

  const stage: IngestionStage = {
    name: 'embedding',

    async isComplete(context: StageContext): Promise<boolean> {
      // Check if every chunk for this version already has an embedding
      // for the configured model+version.
      const result = await context.pool.query<{ unembedded: string }>(
        `SELECT COUNT(*)::text AS unembedded
         FROM document_chunks dc
         WHERE dc.workspace_id = $1
           AND dc.document_version_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM chunk_embeddings ce
             WHERE ce.chunk_id = dc.id
               AND ce.embedding_model = $3
               AND ce.embedding_version = $4
           )`,
        [context.version.workspaceId, context.version.id, embeddingModel, embeddingVersion],
      );
      return parseInt(result.rows[0]?.unembedded ?? '1', 10) === 0;
    },

    async execute(context: StageContext): Promise<StageResult> {
      const { workspaceId, id: versionId } = context.version;

      // 1. Fetch all chunks for this version (id + content), ordered by ordinal.
      //    This must run before isComplete so that the "no chunks" error is not
      //    suppressed by isComplete returning true when there are zero chunks.
      const chunksResult = await context.pool.query<{
        id: string;
        content: string;
        ordinal: number;
      }>(
        `SELECT id, content, ordinal
         FROM document_chunks
         WHERE workspace_id = $1 AND document_version_id = $2
         ORDER BY ordinal`,
        [workspaceId, versionId],
      );

      const allChunks = chunksResult.rows;
      if (allChunks.length === 0) {
        throw new TerminalJobError('No chunks found for embedding stage', 'EMBEDDING_NO_CHUNKS');
      }

      // Quick idempotency guard — must run after the no-chunks check above.
      if (await stage.isComplete(context)) {
        return { performed: false };
      }

      // 2. Determine which chunks still need embeddings
      const embeddedResult = await context.pool.query<{ chunk_id: string }>(
        `SELECT chunk_id
         FROM chunk_embeddings
         WHERE workspace_id = $1
           AND chunk_id = ANY($2::uuid[])
           AND embedding_model = $3
           AND embedding_version = $4`,
        [workspaceId, allChunks.map((c) => c.id), embeddingModel, embeddingVersion],
      );

      const embeddedIds = new Set(embeddedResult.rows.map((r) => r.chunk_id));
      const pendingChunks = allChunks.filter((c) => !embeddedIds.has(c.id));

      if (pendingChunks.length === 0) {
        return { performed: false };
      }

      // 3. Process chunks in batches
      let totalEmbedded = 0;

      for (let offset = 0; offset < pendingChunks.length; offset += batchSize) {
        const batch = pendingChunks.slice(offset, offset + batchSize);

        // Call the provider for this batch
        const response = await provider.embed({
          model: { ...modelConfig },
          inputs: batch.map((chunk, i) => ({
            index: i,
            text: chunk.content,
          })),
        });

        // 4. Persist embeddings — one INSERT per chunk, with idempotency guard
        // Build a map from input index → vector for fast lookup
        const vectorByIndex = new Map<number, number[]>();
        for (const result of response.results) {
          vectorByIndex.set(result.index, result.vector);
        }

        // Validate dimension match
        for (const vec of vectorByIndex.values()) {
          if (vec.length !== dimensions) {
            throw new TerminalJobError(
              `Embedding dimension mismatch: expected ${dimensions}, got ${vec.length}`,
              'EMBEDDING_DIMENSION_MISMATCH',
            );
          }
        }

        for (let i = 0; i < batch.length; i++) {
          const chunk = batch[i]!;
          const vector = vectorByIndex.get(i);
          if (!vector) {
            // Provider didn't return a vector for this input — treat as transient
            // by throwing a generic error (will be retried)
            throw new Error(`Embedding provider did not return vector for chunk at index ${i}`);
          }

          const vectorStr = `[${vector.join(',')}]`;

          try {
            await context.pool.query(
              `INSERT INTO chunk_embeddings (
                 workspace_id, chunk_id, embedding_model,
                 embedding_dimensions, embedding_version, embedding
               ) VALUES ($1, $2, $3, $4, $5, $6::vector)`,
              [workspaceId, chunk.id, embeddingModel, dimensions, embeddingVersion, vectorStr],
            );
            totalEmbedded++;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
              // Already embedded by a prior attempt — idempotent, continue
              continue;
            }
            // Check constraint violation — dimension mismatch at DB level
            if (msg.includes('violates check constraint')) {
              throw new TerminalJobError(
                `Embedding dimension constraint violation: ${msg}`,
                'EMBEDDING_DB_CONSTRAINT',
              );
            }
            // All other errors: re-throw as transient
            throw err;
          }
        }
      }

      return {
        performed: totalEmbedded > 0,
        metadata: {
          model: embeddingModel,
          dimensions,
          version: embeddingVersion,
          totalChunks: allChunks.length,
          pendingChunks: pendingChunks.length,
          embeddedCount: totalEmbedded,
          batchSize,
        },
      };
    },
  };

  return stage;
}
