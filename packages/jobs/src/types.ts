import type { PoolClient } from 'pg';

/**
 * Well-known job statuses matching the {@link outbox_events.status} column.
 */
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DEAD';

/**
 * Discriminated set of job event types derived from the architecture
 * specification §10 recommended events.
 *
 * Consumers MUST tolerate additive fields on any event payload.
 */
export type JobEventType =
  | 'document.upload.completed'
  | 'document.ingestion.requested'
  | 'document.version.ready'
  | 'conversation.response.completed'
  | 'feedback.recorded'
  | 'memory.candidate.created'
  | 'approval.requested'
  | 'tool.execution.completed'
  | 'evaluation.run.completed';

/**
 * Persistent view of one row in the `outbox_events` table.
 */
export interface OutboxRecord {
  id: string;
  workspaceId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: JobEventType;
  schemaVersion: number;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempt: number;
  availableAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
}

/**
 * Parameters for publishing one or more outbox events inside a transaction.
 */
export interface OutboxEventInput {
  workspaceId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: JobEventType;
  schemaVersion: number;
  payload: Record<string, unknown>;
  /** When the event becomes available for processing (defaults to now). */
  availableAt?: Date;
}

/**
 * Error classifier returned by a handler when a job cannot be retried.
 *
 * Throw this (or a subclass) to send the job directly to the dead-letter
 * queue instead of scheduling a retry.
 */
export class TerminalJobError extends Error {
  public readonly reasonCode: string;

  constructor(message: string, reasonCode: string) {
    super(message);
    this.name = 'TerminalJobError';
    this.reasonCode = reasonCode;
  }
}

/**
 * A function that, given the current attempt count and an error,
 * determines whether the job should be retried and, if so, how long to wait.
 */
export interface RetryPolicy {
  /** Milliseconds to wait before the next attempt, or `false` if the error is terminal. */
  delayMs(attempt: number, error: Error): number | false;
}

/**
 * Execution context injected into every job handler invocation.
 */
export interface JobContext {
  /** Unique correlation identifier for this job execution. */
  correlationId: string;
  /** The current attempt number (1-based). */
  attempt: number;
  /** Service identity of the worker processing this job. */
  workerIdentity: string;
  /** UTC timestamp when processing started. */
  startedAt: Date;
}

/**
 * Contract every job handler must satisfy.
 */
export interface JobHandler {
  /** The event type this handler processes. */
  readonly eventType: JobEventType;

  /**
   * Execute the business logic.
   *
   * - Throw {@link TerminalJobError} when the job cannot succeed regardless
   *   of retries.
   * - Throw any other `Error` when a transient failure may resolve on retry.
   * - Return `void` when processing succeeds.
   */
  handle(record: OutboxRecord, context: JobContext): Promise<void>;
}

/**
 * Parameter object for {@link publishOutboxEvents}.
 */
export interface PublishOutboxEventsParams {
  /** An active pg PoolClient, typically inside a transaction. */
  client: PoolClient;
  /** One or more events to publish atomically. */
  events: OutboxEventInput[];
}
