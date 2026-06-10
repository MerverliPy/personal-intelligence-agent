import type { DocumentVersionStatus, IngestionJobStatus } from './types.js';

// ---------------------------------------------------------------------------
// Document version state machine
// ---------------------------------------------------------------------------

/**
 * Valid transitions for document version lifecycle.
 *
 * From docs/03_DATA_MODEL.md#4-state-machines:
 *   PENDING_UPLOAD -> UPLOADED
 *   UPLOADED -> QUARANTINED | INGESTING
 *   INGESTING -> READY | FAILED
 *   READY -> SUPERSEDED | DELETED
 *   FAILED -> INGESTING (explicit retry)
 */
const DOCUMENT_VERSION_TRANSITIONS: ReadonlyMap<
  DocumentVersionStatus,
  readonly DocumentVersionStatus[]
> = new Map([
  ['PENDING_UPLOAD', ['UPLOADED']],
  ['UPLOADED', ['QUARANTINED', 'INGESTING']],
  ['QUARANTINED', []],
  ['INGESTING', ['READY', 'FAILED']],
  ['READY', ['SUPERSEDED', 'DELETED']],
  ['FAILED', ['INGESTING']],
  ['SUPERSEDED', []],
  ['DELETED', []],
]);

/**
 * Returns `true` when `from -> to` is a valid document version state transition.
 */
export function isValidDocumentVersionTransition(
  from: DocumentVersionStatus,
  to: DocumentVersionStatus,
): boolean {
  const allowed = DOCUMENT_VERSION_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Returns the set of allowed next states from a given document version status.
 * Returns an empty array for terminal states.
 */
export function allowedDocumentVersionTransitions(
  from: DocumentVersionStatus,
): readonly DocumentVersionStatus[] {
  return DOCUMENT_VERSION_TRANSITIONS.get(from) ?? [];
}

/**
 * Validates and returns the new status after a transition.
 * Throws if the transition is not allowed.
 */
export function transitionDocumentVersion(
  from: DocumentVersionStatus,
  to: DocumentVersionStatus,
): DocumentVersionStatus {
  if (!isValidDocumentVersionTransition(from, to)) {
    throw new Error(`Illegal document version state transition: ${from} -> ${to}`);
  }
  return to;
}

/**
 * Returns `true` for versions that should be included in default retrieval.
 * Only `READY` versions are retrievable.
 */
export function isRetrievableVersion(status: DocumentVersionStatus): boolean {
  return status === 'READY';
}

// ---------------------------------------------------------------------------
// Ingestion job state machine
// ---------------------------------------------------------------------------

/**
 * Valid transitions for ingestion job lifecycle.
 *
 * From docs/03_DATA_MODEL.md#4-state-machines:
 *   QUEUED -> RUNNING
 *   RUNNING -> SUCCEEDED | RETRY_WAIT | FAILED_FINAL | CANCELLED
 *   RETRY_WAIT -> RUNNING
 */
const INGESTION_JOB_TRANSITIONS: ReadonlyMap<IngestionJobStatus, readonly IngestionJobStatus[]> =
  new Map([
    ['QUEUED', ['RUNNING']],
    ['RUNNING', ['SUCCEEDED', 'RETRY_WAIT', 'FAILED_FINAL', 'CANCELLED']],
    ['RETRY_WAIT', ['RUNNING']],
    ['SUCCEEDED', []],
    ['FAILED_FINAL', []],
    ['CANCELLED', []],
  ]);

/**
 * Returns `true` when `from -> to` is a valid ingestion job state transition.
 */
export function isValidIngestionJobTransition(
  from: IngestionJobStatus,
  to: IngestionJobStatus,
): boolean {
  const allowed = INGESTION_JOB_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Returns the set of allowed next states from a given ingestion job status.
 * Returns an empty array for terminal states.
 */
export function allowedIngestionJobTransitions(
  from: IngestionJobStatus,
): readonly IngestionJobStatus[] {
  return INGESTION_JOB_TRANSITIONS.get(from) ?? [];
}

/**
 * Validates and returns the new status after a transition.
 * Throws if the transition is not allowed.
 */
export function transitionIngestionJob(
  from: IngestionJobStatus,
  to: IngestionJobStatus,
): IngestionJobStatus {
  if (!isValidIngestionJobTransition(from, to)) {
    throw new Error(`Illegal ingestion job state transition: ${from} -> ${to}`);
  }
  return to;
}
