// ---------------------------------------------------------------------------
// Sensitivity classification
// ---------------------------------------------------------------------------

/**
 * Sensitivity classes mirror the `sensitivity_class` PostgreSQL enum.
 * Created in migration 001, reused by knowledge entities.
 */
export type SensitivityClass =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'HIGHLY_CONFIDENTIAL'
  | 'REGULATED'
  | 'PROHIBITED';

// ---------------------------------------------------------------------------
// Document version status
// ---------------------------------------------------------------------------

/** Lifecycle states for document versions (`document_version_status` enum). */
export type DocumentVersionStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'INGESTING'
  | 'READY'
  | 'FAILED'
  | 'SUPERSEDED'
  | 'DELETED';

// ---------------------------------------------------------------------------
// Ingestion job status
// ---------------------------------------------------------------------------

/** Lifecycle states for ingestion jobs (`ingestion_job_status` enum). */
export type IngestionJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'RETRY_WAIT'
  | 'SUCCEEDED'
  | 'FAILED_FINAL'
  | 'CANCELLED';

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export interface Source {
  id: string;
  workspaceId: string;
  projectId: string | null;
  sourceType: string;
  name: string;
  authorityRank: number;
  sensitivity: SensitivityClass;
  externalReference: string | null;
  configuration: Record<string, unknown>;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSourceInput {
  workspaceId: string;
  projectId?: string | null;
  sourceType: string;
  name: string;
  authorityRank?: number;
  sensitivity?: SensitivityClass;
  externalReference?: string | null;
  configuration?: Record<string, unknown>;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// StoredFile
// ---------------------------------------------------------------------------

export interface StoredFile {
  id: string;
  workspaceId: string;
  storageProvider: string;
  objectKey: string;
  originalFilename: string;
  declaredMimeType: string | null;
  detectedMimeType: string | null;
  sizeBytes: number;
  checksumSha256: string;
  scanStatus: string;
  scanMetadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface CreateStoredFileInput {
  workspaceId: string;
  storageProvider: string;
  objectKey: string;
  originalFilename: string;
  declaredMimeType?: string | null;
  sizeBytes: number;
  checksumSha256: string;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  workspaceId: string;
  projectId: string | null;
  sourceId: string | null;
  title: string;
  sensitivity: SensitivityClass;
  currentVersionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDocumentInput {
  workspaceId: string;
  projectId?: string | null;
  sourceId?: string | null;
  title: string;
  sensitivity?: SensitivityClass;
  createdBy: string;
}

export interface UpdateDocumentInput {
  title?: string;
  sensitivity?: SensitivityClass;
  currentVersionId?: string | null;
}

// ---------------------------------------------------------------------------
// DocumentVersion
// ---------------------------------------------------------------------------

export interface DocumentVersion {
  id: string;
  workspaceId: string;
  documentId: string;
  storedFileId: string;
  versionNumber: number;
  status: DocumentVersionStatus;
  isCurrent: boolean;
  checksumSha256: string;
  pipelineVersion: string | null;
  extractionMetadata: Record<string, unknown>;
  failureCode: string | null;
  failureSafeMessage: string | null;
  readyAt: string | null;
  supersededAt: string | null;
  deletedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateDocumentVersionInput {
  workspaceId: string;
  documentId: string;
  storedFileId: string;
  checksumSha256: string;
  pipelineVersion?: string | null;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// IngestionJob
// ---------------------------------------------------------------------------

export interface IngestionJob {
  id: string;
  workspaceId: string;
  documentVersionId: string;
  idempotencyKey: string;
  pipelineVersion: string;
  status: IngestionJobStatus;
  stage: string | null;
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorCode: string | null;
  errorSafeMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIngestionJobInput {
  workspaceId: string;
  documentVersionId: string;
  idempotencyKey: string;
  pipelineVersion: string;
}
