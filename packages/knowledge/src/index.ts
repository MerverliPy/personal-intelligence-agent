export type {
  SensitivityClass,
  DocumentVersionStatus,
  IngestionJobStatus,
  Source,
  CreateSourceInput,
  StoredFile,
  CreateStoredFileInput,
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentVersion,
  CreateDocumentVersionInput,
  IngestionJob,
  CreateIngestionJobInput,
} from './types.js';

export {
  isValidDocumentVersionTransition,
  allowedDocumentVersionTransitions,
  transitionDocumentVersion,
  isRetrievableVersion,
  isValidIngestionJobTransition,
  allowedIngestionJobTransitions,
  transitionIngestionJob,
} from './state-machine.js';

export {
  createSource,
  getSourceById,
  listSources,
  softDeleteSource,
  createStoredFile,
  getStoredFileByKey,
  getStoredFileById,
  updateStoredFileScanResult,
  createDocument,
  getDocumentById,
  listDocuments,
  softDeleteDocument,
  createDocumentVersion,
  getDocumentVersionById,
  listVersions,
  transitionDocumentVersionStatus,
  setCurrentVersion,
  createIngestionJob,
  getIngestionJobById,
  transitionIngestionJobStatus,
  listPendingJobs,
  updateIngestionJobStage,
  updateIngestionJobError,
  updateIngestionJobAttempt,
} from './repositories.js';

// ---------------------------------------------------------------------------
// Scan provider
// ---------------------------------------------------------------------------

export type { ScanInput, ScanResult, ScanProvider } from './scan.js';
export {
  createNoopScanProvider,
  isDefaultAllowedMimeType,
  defaultAllowedMimeTypes,
} from './scan.js';

// ---------------------------------------------------------------------------
// Ingestion workflow
// ---------------------------------------------------------------------------

export type {
  IngestionStage,
  StageContext,
  StageResult,
  IngestionStageName,
} from './ingestion/types.js';
export { INGESTION_STAGE_NAMES } from './ingestion/types.js';

export {
  noopExtractionStage,
  noopChunkingStage,
  noopEmbeddingStage,
} from './ingestion/noop-stages.js';

export { publishingStage } from './ingestion/publishing-stage.js';

export { IngestionWorkflowHandler, type IngestionWorkflowConfig } from './ingestion/workflow.js';
