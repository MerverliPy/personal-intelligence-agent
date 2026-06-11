// ---------------------------------------------------------------------------
// Chunking stage — IngestionStage for the chunking pipeline step
// ---------------------------------------------------------------------------
// Replaces `noopChunkingStage`. Uses the chunking strategy to split parsed
// document text into retrieval-optimized chunks and persists them to the
// `document_chunks` table with full provenance.
//
// ## Idempotency
//
//   - `isComplete()` checks whether any chunks exist for the version.
//   - `execute()` uses INSERT with the UNIQUE(document_version_id, ordinal)
//     constraint to prevent duplicate artefacts.
//   - Duplicate key violations from concurrent execution are caught and
//     treated as already-complete.
//
// ## Full text access
//
//   The chunking stage requires the full document text. A `loadText`
//   adapter MUST be provided. It receives the workspaceId and storedFileId
//   and returns the normalized plain text. In production this loads the
//   file from object storage and may invoke a lightweight parser; in tests
//   it is wired directly to pre-parsed text.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { IngestionStage, StageContext, StageResult } from '../ingestion/types.js';
import { TerminalJobError } from '@pia/jobs';
import { getDocumentVersionById } from '../repositories.js';
import type { ChunkingOptions } from './types.js';
import { DEFAULT_CHUNKING_OPTIONS } from './types.js';
import { defaultChunkingStrategy } from './chunking-strategy.js';
import type { ChunkingStrategy } from './types.js';
import type { Locator } from '../parsing/types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Options for constructing a chunking stage.
 */
export interface CreateChunkingStageOptions {
  /** Database pool for chunk persistence. */
  pool: Pool;
  /**
   * Adapter that returns the full normalized plain text for a stored file.
   *
   * Called with (workspaceId, storedFileId). Must return the complete
   * document text as produced by the parsing stage.
   */
  loadText: (workspaceId: string, storedFileId: string) => Promise<string>;
  /** Chunking strategy to use (defaults to `defaultChunkingStrategy`). */
  strategy?: ChunkingStrategy;
  /** Chunking options override (merged with defaults). */
  options?: Partial<ChunkingOptions>;
}

// ---------------------------------------------------------------------------
// Stage factory
// ---------------------------------------------------------------------------

/**
 * Creates the real chunking stage for the ingestion pipeline.
 */
export function createChunkingStage(options: CreateChunkingStageOptions): IngestionStage {
  const { pool, loadText, strategy = defaultChunkingStrategy, options: partialOptions } = options;

  const chunkingOptions: ChunkingOptions = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...partialOptions,
  };

  const stage: IngestionStage = {
    name: 'chunking',

    async isComplete(context: StageContext): Promise<boolean> {
      // Check if any chunks already exist for this version
      const result = await context.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM document_chunks
         WHERE workspace_id = $1 AND document_version_id = $2`,
        [context.version.workspaceId, context.version.id],
      );
      return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
    },

    async execute(context: StageContext): Promise<StageResult> {
      // Quick idempotency guard
      if (await stage.isComplete(context)) {
        return { performed: false };
      }

      // 1. Load the full document text
      let text: string;
      try {
        text = await loadText(context.version.workspaceId, context.version.storedFileId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TerminalJobError(
          `Failed to load document text: ${msg}`,
          'CHUNKING_TEXT_LOAD_FAILED',
        );
      }

      if (!text || text.length === 0) {
        throw new TerminalJobError('Document text is empty — cannot chunk', 'CHUNKING_EMPTY_TEXT');
      }

      // 2. Extract locators from extraction metadata
      const extractionMeta = context.version.extractionMetadata ?? {};
      const locators: Locator[] = Array.isArray(extractionMeta['locators'])
        ? (extractionMeta['locators'] as Locator[])
        : [];

      // 3. Generate chunks
      const result = strategy.chunk({
        text,
        locators,
        options: chunkingOptions,
      });

      // 4. Determine document-level project_id and source_id
      const version = await getDocumentVersionById(
        pool,
        context.version.workspaceId,
        context.version.id,
      );

      if (!version) {
        throw new TerminalJobError(
          `Document version not found: ${context.version.id}`,
          'CHUNKING_VERSION_NOT_FOUND',
        );
      }

      // Get document for project_id/source_id
      const docResult = await pool.query<{ project_id: string | null; source_id: string | null }>(
        `SELECT project_id, source_id FROM documents
         WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [context.version.workspaceId, context.version.documentId],
      );

      const projectId = docResult.rows[0]?.project_id ?? null;
      const sourceId = docResult.rows[0]?.source_id ?? null;

      // 5. Persist chunks with idempotency guard
      let insertedCount = 0;
      const duplicateOrdinals = new Set<number>();

      for (const chunk of result.chunks) {
        try {
          await context.pool.query(
            `INSERT INTO document_chunks (
               workspace_id, project_id, document_id, document_version_id,
               source_id, ordinal, content, content_hash, locator,
               heading_path, token_count, chunking_version
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              context.version.workspaceId,
              projectId,
              context.version.documentId,
              context.version.id,
              sourceId,
              chunk.ordinal,
              chunk.content,
              chunk.contentHash,
              JSON.stringify(chunk.locator),
              chunk.headingPath,
              chunk.tokenCount ?? null,
              result.strategyVersion,
            ],
          );
          insertedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
            duplicateOrdinals.add(chunk.ordinal);
            // Continue — this ordinal was already inserted by a prior attempt
            continue;
          }
          throw new TerminalJobError(
            `Failed to insert chunk ordinal ${chunk.ordinal}: ${msg}`,
            'CHUNKING_INSERT_FAILED',
          );
        }
      }

      if (insertedCount === 0 && duplicateOrdinals.size > 0) {
        // All chunks already existed — fully idempotent
        return {
          performed: false,
          metadata: { chunkCount: duplicateOrdinals.size, strategyVersion: result.strategyVersion },
        };
      }

      return {
        performed: true,
        metadata: {
          chunkCount: insertedCount,
          strategyVersion: result.strategyVersion,
          totalCharacters: result.metadata.totalCharacters,
          averageChunkSize: result.metadata.averageChunkSize,
        },
      };
    },
  };

  return stage;
}
