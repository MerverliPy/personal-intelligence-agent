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

// ---------------------------------------------------------------------------
// Parsing (P2-T04)
// ---------------------------------------------------------------------------

export type {
  Locator,
  LocatorType,
  ParsedMetadata,
  ParsedDocument,
  ParserInput,
  Parser,
  ParserCategory,
} from './parsing/types.js';
export { ParserError, findParser, unsupportedFormatError } from './parsing/types.js';
export { PlainTextParser, plainTextParser } from './parsing/plain-text-parser.js';
export { PdfParser, pdfParser } from './parsing/pdf-parser.js';
export { DocxParser, docxParser } from './parsing/docx-parser.js';
export type { ExtractionLimits, CreateExtractionStageOptions } from './parsing/extraction-stage.js';
export { createExtractionStage } from './parsing/extraction-stage.js';

// ---------------------------------------------------------------------------
// Chunking (P2-T05)
// ---------------------------------------------------------------------------

export type {
  Chunk,
  ChunkingOptions,
  ChunkingInput,
  ChunkingResult,
  ChunkingMetadata,
  ChunkingStrategy,
} from './chunking/types.js';
export { DEFAULT_CHUNKING_OPTIONS } from './chunking/types.js';
export {
  createDefaultChunkingStrategy,
  defaultChunkingStrategy,
} from './chunking/chunking-strategy.js';
export type { CreateChunkingStageOptions } from './chunking/chunking-stage.js';
export { createChunkingStage } from './chunking/chunking-stage.js';

// ---------------------------------------------------------------------------
// Embeddings (P2-T06)
// ---------------------------------------------------------------------------

export type {
  EmbeddingProvider,
  EmbeddingModelConfig,
  EmbeddingInput,
  EmbeddingResult,
  EmbeddingRequest,
  EmbeddingResponse,
} from './embeddings/types.js';

export {
  createFakeEmbeddingProvider,
  fakeEmbeddingProvider,
  defaultFakeModelConfig,
} from './embeddings/fake-provider.js';

export type { CreateEmbeddingStageOptions } from './embeddings/embedding-stage.js';
export { createEmbeddingStage } from './embeddings/embedding-stage.js';

// ---------------------------------------------------------------------------
// Retrieval (P2-T07)
// ---------------------------------------------------------------------------

export type {
  RetrievalQuery,
  RetrievalResult,
  RetrievalCandidate,
  RetrievalConfig,
  RetrievalTrace,
  RetrievalResponse,
} from './retrieval/types.js';
export { executeLexicalSearch } from './retrieval/lexical-search.js';
export type { VectorSearchOptions } from './retrieval/vector-search.js';
export { executeVectorSearch } from './retrieval/vector-search.js';
export {
  reciprocalRankFusion,
  deduplicateByContentHash,
  computeRrfScores,
} from './retrieval/fusion.js';
export type { RetrievalServiceConfig } from './retrieval/retrieval-service.js';
export { RetrievalService } from './retrieval/retrieval-service.js';
