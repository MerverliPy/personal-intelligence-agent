import type { Pool } from 'pg';
import type { Logger } from '@pia/observability';
import { runWithCorrelation, createCorrelationContext } from '@pia/observability';
import type { JobHandler, JobContext, OutboxRecord, OutboxStatus } from './types.js';
import { createExponentialBackoffRetryPolicy, isTerminalError } from './retry.js';

/**
 * Configuration for a {@link JobConsumer} instance.
 */
export interface JobConsumerConfig {
  /** Unique identifier for this worker instance (e.g. `worker-1`). */
  workerIdentity: string;
  /** Maximum number of jobs to fetch in one poll cycle. */
  batchSize?: number;
  /** Interval in milliseconds between poll cycles when no work is found. */
  pollIntervalMs?: number;
  /** Maximum concurrent jobs this consumer will process. */
  concurrency?: number;
  /** Maximum attempts before a job is moved to DEAD. */
  maxAttempts?: number;
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Polls the `outbox_events` table for PENDING work and dispatches each row
 * to the registered {@link JobHandler}.
 *
 * ## Idempotency
 *
 * Before invoking the handler the consumer updates the outbox row status to
 * `PROCESSING`. If the handler completes without error the status is set to
 * `COMPLETED` and `published_at` is stamped. On failure the attempt counter
 * is incremented and the retry policy determines whether the job returns to
 * `PENDING` (with a future `available_at`) or moves to `DEAD`.
 *
 * Handlers MUST be idempotent — a job may be delivered more than once if the
 * worker crashes between `PROCESSING` and `COMPLETED`.
 */
export class JobConsumer {
  private readonly pool: Pool;
  private readonly config: Required<JobConsumerConfig>;
  private readonly logger: Logger;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly retryPolicy = createExponentialBackoffRetryPolicy(
    DEFAULT_MAX_ATTEMPTS,
    1_000,
    60_000,
  );

  private running = false;
  private activeCount = 0;

  constructor(pool: Pool, logger: Logger, config: JobConsumerConfig) {
    this.pool = pool;
    this.logger = logger;
    this.config = {
      workerIdentity: config.workerIdentity,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      pollIntervalMs: config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      concurrency: config.concurrency ?? DEFAULT_CONCURRENCY,
      maxAttempts: config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    };
  }

  /**
   * Registers a handler for a specific event type.
   *
   * Only one handler per event type is permitted; registering a duplicate
   * overrides the previous registration.
   */
  register(handler: JobHandler): void {
    this.handlers.set(handler.eventType, handler);
    this.logger.info('JobConsumer: registered handler', {
      eventType: handler.eventType,
    });
  }

  /**
   * Starts the poll loop. Safe to call multiple times — subsequent calls
   * are no-ops.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.logger.info('JobConsumer: starting', {
      workerIdentity: this.config.workerIdentity,
      batchSize: this.config.batchSize,
      pollIntervalMs: this.config.pollIntervalMs,
      concurrency: this.config.concurrency,
    });
    // Fire the first poll; subsequent polls are scheduled by `scheduleNext`
    void this.poll();
  }

  /**
   * Signals the consumer to stop after the current batch completes.
   * Does not wait for in-flight jobs to finish.
   */
  stop(): void {
    this.running = false;
    this.logger.info('JobConsumer: stopping');
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    setTimeout(() => {
      void this.poll();
    }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Concurrency gate
    if (this.activeCount >= this.config.concurrency) {
      this.scheduleNext();
      return;
    }

    try {
      const jobs = await this.fetchPending();
      if (jobs.length === 0) {
        this.scheduleNext();
        return;
      }

      // Process each job independently
      for (const record of jobs) {
        if (!this.running) {
          break;
        }

        // Check handler availability outside the concurrency cap
        const handler = this.handlers.get(record.eventType);
        if (!handler) {
          this.logger.warn('JobConsumer: no handler for event type', {
            eventType: record.eventType,
            jobId: record.id,
          });
          await this.markDead(
            record.id,
            `No handler registered for event type "${record.eventType}"`,
          );
          continue;
        }

        // Acquire concurrency slot
        this.activeCount++;
        void this.processJob(record, handler).finally(() => {
          this.activeCount--;
        });
      }
    } catch (err) {
      this.logger.error('JobConsumer: poll error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.scheduleNext();
  }

  private async processJob(record: OutboxRecord, handler: JobHandler): Promise<void> {
    const startedAt = new Date();

    try {
      // Mark as PROCESSING before invoking handler
      await this.updateStatus(record.id, 'PROCESSING');
    } catch (err) {
      this.logger.error('JobConsumer: failed to mark PROCESSING', {
        jobId: record.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const context: JobContext = {
      correlationId: record.id,
      attempt: record.attempt + 1,
      workerIdentity: this.config.workerIdentity,
      startedAt,
    };

    try {
      await runWithCorrelation(async () => {
        await handler.handle(record, context);
      }, createCorrelationContext(record.id));

      // Success
      await this.markCompleted(record.id);
      this.logger.info('JobConsumer: job completed', {
        jobId: record.id,
        eventType: record.eventType,
        attempt: context.attempt,
        durationMs: Date.now() - startedAt.getTime(),
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const terminal = isTerminalError(error);

      this.logger.error('JobConsumer: job failed', {
        jobId: record.id,
        eventType: record.eventType,
        attempt: context.attempt,
        terminal,
        error: error.message,
      });

      if (terminal) {
        await this.markDead(record.id, error.message);
        return;
      }

      const delayMs = this.retryPolicy.delayMs(context.attempt, error);
      if (delayMs === false) {
        await this.markDead(
          record.id,
          `Exhausted retries after attempt ${context.attempt}: ${error.message}`,
        );
        return;
      }

      await this.scheduleRetry(record.id, context.attempt, delayMs);
    }
  }

  // -----------------------------------------------------------------------
  // Database operations
  // -----------------------------------------------------------------------

  /**
   * Fetches the next batch of PENDING outbox rows whose `available_at` has
   * elapsed, ordered by creation time.
   */
  private async fetchPending(): Promise<OutboxRecord[]> {
    const result = await this.pool.query<OutboxRecord>(
      `
      UPDATE outbox_events
      SET status = 'PROCESSING'
      WHERE id IN (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING'
          AND available_at <= now()
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        workspace_id AS "workspaceId",
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        event_type AS "eventType",
        schema_version AS "schemaVersion",
        payload,
        status,
        attempt,
        available_at AS "availableAt",
        published_at AS "publishedAt",
        created_at AS "createdAt"
      `,
      [this.config.batchSize],
    );
    return result.rows;
  }

  private async updateStatus(jobId: string, status: OutboxStatus): Promise<void> {
    await this.pool.query(`UPDATE outbox_events SET status = $2 WHERE id = $1`, [jobId, status]);
  }

  private async markCompleted(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE outbox_events
       SET status = 'COMPLETED',
           published_at = now()
       WHERE id = $1`,
      [jobId],
    );
  }

  private async markDead(jobId: string, reason: string): Promise<void> {
    const payload = JSON.stringify({ dead_reason: reason });
    await this.pool.query(
      `UPDATE outbox_events
       SET status = 'DEAD',
           payload = payload || $2::jsonb,
           published_at = now()
       WHERE id = $1`,
      [jobId, payload],
    );
  }

  private async scheduleRetry(jobId: string, attempt: number, delayMs: number): Promise<void> {
    await this.pool.query(
      `UPDATE outbox_events
       SET status = 'PENDING',
           attempt = $2,
           available_at = now() + ($3::int * interval '1 millisecond')
       WHERE id = $1`,
      [jobId, attempt, delayMs],
    );
  }
}
