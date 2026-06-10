import type { Pool, PoolClient } from 'pg';
import type { IngestionStage, StageContext, StageResult } from './types.js';
import { transitionDocumentVersionStatus, setCurrentVersion } from '../repositories.js';

/**
 * Publishing stage — the final stage of every ingestion pipeline.
 *
 * Atomically (within a DB transaction):
 * 1. Transitions the document version to `READY`.
 * 2. Sets the version as the document's current version.
 *
 * This stage is the only one that can mark a version ready. All preceding
 * stages must complete successfully before this stage executes.
 *
 * ## Idempotency
 *
 * If the version is already `READY`, this stage is a no-op. This handles
 * the case where a crash occurred after the DB committed READY but before
 * the job was marked SUCCEEDED.
 */
export const publishingStage: IngestionStage = {
  name: 'publishing',

  async isComplete(context: StageContext): Promise<boolean> {
    return context.version.status === 'READY';
  },

  async execute(context: StageContext): Promise<StageResult> {
    if (context.version.status === 'READY') {
      return { performed: false };
    }

    const client: PoolClient = await context.pool.connect();
    try {
      await client.query('BEGIN');

      // PoolClient.query is runtime-compatible with Pool.query.
      // The cast is safe because transitionDocumentVersionStatus and
      // setCurrentVersion only call the `query` method.
      const q = client as unknown as Pool;

      await transitionDocumentVersionStatus(
        q,
        context.version.workspaceId,
        context.version.id,
        'READY',
      );

      await setCurrentVersion(
        q,
        context.version.workspaceId,
        context.version.documentId,
        context.version.id,
      );

      await client.query('COMMIT');

      return { performed: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
