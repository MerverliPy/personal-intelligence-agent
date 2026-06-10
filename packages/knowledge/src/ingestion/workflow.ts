import type { Pool } from 'pg';
import type { Logger } from '@pia/observability';
import type { JobHandler, JobContext, OutboxRecord, JobEventType } from '@pia/jobs';
import { TerminalJobError } from '@pia/jobs';
import type { IngestionStage, IngestionStageName } from './types.js';
import { INGESTION_STAGE_NAMES } from './types.js';
import {
  getIngestionJobById,
  getDocumentVersionById,
  transitionIngestionJobStatus,
  updateIngestionJobStage,
  updateIngestionJobError,
  updateIngestionJobAttempt,
} from '../repositories.js';
import { publishingStage } from './publishing-stage.js';

// ---------------------------------------------------------------------------
// Ingestion workflow handler
// ---------------------------------------------------------------------------

/**
 * Configuration for constructing an {@link IngestionWorkflowHandler}.
 */
export interface IngestionWorkflowConfig {
  /** Database pool for all pipeline queries. */
  pool: Pool;
  /** Structured logger for observability. */
  logger: Logger;
  /**
   * Map of stage name → stage implementation.
   *
   * Providing a partial map allows callers to override individual stages
   * without re-registering every stage. Missing entries cause the workflow
   * to fail with a terminal error.
   */
  stages?: Partial<Record<IngestionStageName, IngestionStage>>;
}

const DEFAULT_STAGES = {
  extraction: undefined as IngestionStage | undefined,
  chunking: undefined as IngestionStage | undefined,
  embedding: undefined as IngestionStage | undefined,
  publishing: publishingStage,
};

/**
 * Durable, idempotent ingestion workflow that processes
 * `document.ingestion.requested` outbox events.
 *
 * ## Stages
 *
 * The pipeline runs through five ordered stages:
 *
 *   1. **extraction**  — parse content and produce structured locators
 *   2. **chunking**    — split into overlapping retrieval chunks
 *   3. **embedding**   — generate vector embeddings per chunk
 *   4. **publishing**  — atomically mark version READY and set as current
 *
 * Each completed stage is persisted as a checkpoint in
 * `ingestion_jobs.stage`. If the worker crashes mid-pipeline, the
 * next delivery resumes from the first incomplete stage.
 *
 * ## Idempotency
 *
 * - Repeated job delivery skips stages already recorded as complete
 *   by consulting each stage's `isComplete()` method.
 * - Stage implementations use database UNIQUE constraints to prevent
 *   duplicate artefacts (chunks, embeddings).
 *
 * ## Atomic publication
 *
 * The publishing stage transitions the version to `READY` and calls
 * `setCurrentVersion` inside a single database transaction. A failed
 * stage **never** marks a version ready — the orchestrator transitions
 * the job to `RETRY_WAIT` or `FAILED_FINAL` and leaves the version in
 * `INGESTING` state.
 */
export class IngestionWorkflowHandler implements JobHandler {
  readonly eventType: JobEventType = 'document.ingestion.requested';

  private readonly pool: Pool;
  private readonly logger: Logger;
  private readonly stages: Record<IngestionStageName, IngestionStage | undefined>;

  constructor(config: IngestionWorkflowConfig) {
    this.pool = config.pool;
    this.logger = config.logger;
    this.stages = {
      ...DEFAULT_STAGES,
      ...config.stages,
    } as Record<IngestionStageName, IngestionStage | undefined>;
  }

  /**
   * Entry-point called by the {@link JobConsumer} for every
   * `document.ingestion.requested` event.
   */
  async handle(record: OutboxRecord, context: JobContext): Promise<void> {
    const jobId = record.aggregateId;
    const versionId = record.payload['documentVersionId'] as string | undefined;
    const workspaceId = record.workspaceId;

    if (!versionId || !workspaceId) {
      throw new TerminalJobError(
        'Missing versionId or workspaceId in ingestion payload',
        'INGESTION_INVALID_PAYLOAD',
      );
    }

    this.logger.info('IngestionWorkflow: starting', {
      jobId,
      versionId,
      attempt: context.attempt,
      correlationId: context.correlationId,
    });

    // Load entities
    const job = await getIngestionJobById(this.pool, workspaceId, jobId);
    if (!job) {
      throw new TerminalJobError(`Ingestion job not found: ${jobId}`, 'INGESTION_JOB_NOT_FOUND');
    }

    const version = await getDocumentVersionById(this.pool, workspaceId, versionId);
    if (!version) {
      throw new TerminalJobError(
        `Document version not found: ${versionId}`,
        'INGESTION_VERSION_NOT_FOUND',
      );
    }

    // Validate the version is in INGESTING state
    if (version.status !== 'INGESTING') {
      this.logger.warn('IngestionWorkflow: version not in INGESTING state, skipping', {
        versionId,
        status: version.status,
      });
      // Transition job to SUCCEEDED via RUNNING (state machine requires RUNNING first)
      if (job.status === 'QUEUED' || job.status === 'RETRY_WAIT') {
        await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'RUNNING');
      }
      await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'SUCCEEDED');
      return;
    }

    // Update job attempt tracking
    await updateIngestionJobAttempt(this.pool, workspaceId, jobId, context.attempt);

    // Transition job from QUEUED / RETRY_WAIT to RUNNING
    if (job.status === 'QUEUED' || job.status === 'RETRY_WAIT') {
      await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'RUNNING');
    }

    // Determine the starting stage index from the checkpoint.
    const currentCheckpoint = job.stage;
    const startIdx = currentCheckpoint
      ? INGESTION_STAGE_NAMES.indexOf(currentCheckpoint as IngestionStageName)
      : -1;

    const stageContext = {
      pool: this.pool,
      version,
      job,
      correlationId: context.correlationId,
    };

    try {
      // Execute each stage in order, skipping completed stages.
      for (let idx = 0; idx < INGESTION_STAGE_NAMES.length; idx++) {
        const stageName = INGESTION_STAGE_NAMES[idx]!;

        // Skip stages that were completed in a previous run
        if (idx <= startIdx) {
          this.logger.info('IngestionWorkflow: skipping completed stage', {
            stage: stageName,
            versionId,
          });
          continue;
        }

        const stage = this.stages[stageName];
        if (!stage) {
          throw new TerminalJobError(
            `Ingestion stage "${stageName}" not registered`,
            'INGESTION_STAGE_MISSING',
          );
        }

        this.logger.info('IngestionWorkflow: executing stage', {
          stage: stageName,
          versionId,
          attempt: context.attempt,
        });

        // Idempotency check before execution
        const alreadyComplete = await stage.isComplete(stageContext);
        if (alreadyComplete) {
          this.logger.info('IngestionWorkflow: stage already complete (idempotent)', {
            stage: stageName,
            versionId,
          });
          await updateIngestionJobStage(this.pool, workspaceId, jobId, stageName);
          continue;
        }

        // Execute the stage
        const result = await stage.execute(stageContext);

        this.logger.info('IngestionWorkflow: stage completed', {
          stage: stageName,
          versionId,
          performed: result.performed,
          metadata: result.metadata,
        });

        // Persist checkpoint
        await updateIngestionJobStage(this.pool, workspaceId, jobId, stageName);
      }

      // All stages complete — mark the job as succeeded
      await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'SUCCEEDED');

      this.logger.info('IngestionWorkflow: completed successfully', {
        jobId,
        versionId,
        attempt: context.attempt,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const terminal = error instanceof TerminalJobError;

      const errorCode = terminal ? (error as TerminalJobError).reasonCode : 'INGESTION_STAGE_ERROR';
      const safeMessage = `Stage failure: ${error.name}`;

      this.logger.error('IngestionWorkflow: stage failed', {
        versionId,
        error: error.message,
        terminal,
        errorCode,
      });

      // Record error on the job WITHOUT changing version status to READY
      await updateIngestionJobError(this.pool, workspaceId, jobId, errorCode, safeMessage);

      if (terminal) {
        await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'FAILED_FINAL');
        throw error; // Re-throw so consumer sends to DEAD
      }

      // Transient: transition to RETRY_WAIT and re-throw so consumer retries
      await transitionIngestionJobStatus(this.pool, workspaceId, jobId, 'RETRY_WAIT');
      throw error;
    }
  }
}
