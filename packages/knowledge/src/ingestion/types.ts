import type { Pool } from 'pg';
import type { DocumentVersion, IngestionJob } from '../types.js';

// ---------------------------------------------------------------------------
// Ingestion stage contract
// ---------------------------------------------------------------------------

/**
 * Context provided to each ingestion stage. The stage receives the
 * database pool, the document version to process, the ingestion job
 * metadata, and a correlation identifier for logging/tracing.
 */
export interface StageContext {
  /** Database pool for queries inside the stage. */
  pool: Pool;
  /** The document version being ingested. */
  version: DocumentVersion;
  /** The ingestion job coordinating this pipeline run. */
  job: IngestionJob;
  /** Correlation identifier for structured logging and tracing. */
  correlationId: string;
}

/**
 * Result returned by a successfully executed stage.
 */
export interface StageResult {
  /** True when new work was performed; false when the stage was already complete. */
  performed: boolean;
  /** Optional metadata for observability (chunk count, embedding batch size, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Contract every pipeline stage must satisfy.
 *
 * Stages are called in sequence by the workflow orchestrator. Each stage
 * MUST be idempotent — calling it again with the same `StageContext` must
 * not create duplicate artifacts.
 *
 * If a stage throws, the orchestrator records the error, saves the
 * checkpoint of the *previous* completed stage, and transitions the
 * ingestion job to RETRY_WAIT or FAILED_FINAL.
 */
export interface IngestionStage {
  /** Unique name used for checkpoint persistence (e.g. `"extraction"`). */
  readonly name: string;

  /**
   * Execute this stage.
   *
   * @throws TerminalJobError when the failure is non-retryable.
   * @throws any Error for transient failures that should be retried.
   */
  execute(context: StageContext): Promise<StageResult>;

  /**
   * Returns `true` when this stage's work already exists and re-execution
   * would be a no-op. Used by the orchestrator on resumption to skip
   * completed stages after a worker interruption.
   */
  isComplete(context: StageContext): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Well-known stage names
// ---------------------------------------------------------------------------

/** Ordered list of stage names in the ingestion pipeline. */
export const INGESTION_STAGE_NAMES = ['extraction', 'chunking', 'embedding', 'publishing'] as const;

export type IngestionStageName = (typeof INGESTION_STAGE_NAMES)[number];
