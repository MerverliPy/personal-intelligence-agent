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
