// ---------------------------------------------------------------------------
// Error envelope types (per api/openapi.yaml §components/schemas/ErrorEnvelope)
// ---------------------------------------------------------------------------

/** Standard API error envelope returned for all error responses. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: Record<string, unknown>;
  };
}

/** Well-known error codes used across the API. */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Creates a standard API error response.
 */
export function createErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return {
    error: { code, message, request_id: requestId, ...(details ? { details } : {}) },
  };
}

// ---------------------------------------------------------------------------
// Health types (per api/openapi.yaml §components/schemas/HealthResponse)
// ---------------------------------------------------------------------------

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface HealthResponse {
  status: HealthStatus;
  checks?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Principal types (per api/openapi.yaml §components/schemas/Principal)
// ---------------------------------------------------------------------------

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'CURATOR' | 'MEMBER' | 'AUDITOR';

export interface WorkspaceMembershipSummary {
  workspace_id: string;
  role: WorkspaceRole;
}

export interface Principal {
  id: string;
  email: string;
  display_name?: string | null;
  workspaces: WorkspaceMembershipSummary[];
}

// ---------------------------------------------------------------------------
// Workspace types (per api/openapi.yaml §components/schemas/Workspace)
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface WorkspacePage {
  items: Workspace[];
  next_cursor?: string | null;
}

// ---------------------------------------------------------------------------
// Project types (per api/openapi.yaml §components/schemas/Project)
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface ProjectPage {
  items: Project[];
  next_cursor?: string | null;
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

/** Parsed cursor for opaque cursor pagination. */
export interface Cursor {
  /** The timestamp-based cursor value used for ordering. */
  value: string;
}

/** Default limit for paginated endpoints. */
export const DEFAULT_PAGE_LIMIT = 50;

/** Maximum allowed page size. */
export const MAX_PAGE_LIMIT = 200;

/**
 * Encodes a cursor value into an opaque string.
 * Uses base64url-encoded JSON for simplicity.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(JSON.stringify({ value })).toString('base64url');
}

/**
 * Decodes an opaque cursor string back into its value.
 * Returns undefined for invalid cursors.
 */
export function decodeCursor(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  try {
    const parsed: Cursor = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return parsed.value;
  } catch {
    return undefined;
  }
}

/**
 * Normalises a page limit to be within [1, MAX_PAGE_LIMIT].
 */
export function normaliseLimit(limit?: number): number {
  if (limit === undefined || limit === null || Number.isNaN(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.max(1, Math.min(limit, MAX_PAGE_LIMIT));
}

// ---------------------------------------------------------------------------
// Upload types
// ---------------------------------------------------------------------------

/** Request to initiate an upload. */
export interface CreateUploadRequest {
  filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256?: string;
  project_id?: string;
}

/** Response from initiating an upload. */
export interface CreateUploadResponse {
  upload_id: string;
  upload_url: string;
  expires_at: string;
  max_size_bytes: number;
  allowed_types: string[];
}

/** Request to complete an upload. */
export interface CompleteUploadRequest {
  /** The upload ID returned by the initiation endpoint. */
  upload_id: string;
}

/** Response from completing an upload. */
export interface CompleteUploadResponse {
  document_id: string;
  version_id: string;
  version_number: number;
  status: string;
  quarantine_reason?: string | null;
  ingestion_job_id?: string | null;
  checksum_sha256: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Sensitivity and document status types
// ---------------------------------------------------------------------------

/** Sensitivity classification for documents. */
export type Sensitivity =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'HIGHLY_CONFIDENTIAL'
  | 'REGULATED'
  | 'PROHIBITED';

/** Lifecycle states for document versions. */
export type DocumentVersionStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'INGESTING'
  | 'READY'
  | 'FAILED'
  | 'SUPERSEDED'
  | 'DELETED';

/** Lifecycle states for ingestion jobs. */
export type IngestionJobStatusApi =
  | 'QUEUED'
  | 'RUNNING'
  | 'RETRY_WAIT'
  | 'SUCCEEDED'
  | 'FAILED_FINAL'
  | 'CANCELLED';

// ---------------------------------------------------------------------------
// Document types (per api/openapi.yaml §components/schemas/Document)
// ---------------------------------------------------------------------------

/** Structural locator within a document version. */
export interface SourceLocator {
  page?: number | null;
  section?: string | null;
  paragraph?: number | null;
  start_char?: number | null;
  end_char?: number | null;
}

/** A document version summary. */
export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  status: DocumentVersionStatus;
  is_current?: boolean;
  checksum_sha256?: string;
  created_at: string;
}

/** A document with its current version. */
export interface Document {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  title: string;
  sensitivity: Sensitivity;
  current_version?: DocumentVersion | null;
  created_at: string;
}

/** Paginated list of documents. */
export interface DocumentPage {
  items: Document[];
  next_cursor?: string | null;
}

// ---------------------------------------------------------------------------
// Ingestion job types (per api/openapi.yaml §components/schemas/IngestionJob)
// ---------------------------------------------------------------------------

/** An ingestion job resource. */
export interface IngestionJob {
  id: string;
  document_version_id: string;
  status: IngestionJobStatusApi;
  stage?: string | null;
  attempt: number;
  error_code?: string | null;
  created_at: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Operation accepted (per api/openapi.yaml §components/schemas/OperationAccepted)
// ---------------------------------------------------------------------------

/** Response for async operations (e.g. deletion). */
export interface OperationAccepted {
  operation_id: string;
  status: 'ACCEPTED';
}

// ---------------------------------------------------------------------------
// Retrieval types (per api/openapi.yaml §components/schemas/RetrievalQuery)
// ---------------------------------------------------------------------------

/** Request body for a retrieval query. */
export interface RetrievalQueryRequest {
  query: string;
  project_id?: string | null;
  source_ids?: string[];
  history_mode?: 'CURRENT_ONLY' | 'INCLUDE_HISTORY';
  limit?: number;
  include_debug?: boolean;
}

/** A single retrieval result. */
export interface RetrievalResult {
  rank: number;
  chunk_id: string;
  document_id: string;
  document_version_id: string;
  /** UUID of the source this chunk belongs to, or null for sourceless documents. */
  source_id: string | null;
  source_title?: string;
  locator: SourceLocator;
  text: string;
  scores: {
    lexical?: number | null;
    vector?: number | null;
    fused: number;
  };
}

/** Response body for a retrieval query or trace inspection. */
export interface RetrievalResponse {
  trace_id: string;
  configuration_version: string;
  results: RetrievalResult[];
  latency_ms: number;
}

// ---------------------------------------------------------------------------
// Conversation types (per api/openapi.yaml §components/schemas/Conversation)
// ---------------------------------------------------------------------------

/** Valid conversation modes. */
export type ConversationMode = 'ASK' | 'RESEARCH' | 'ANALYZE' | 'PLAN' | 'EXECUTE' | 'LEARN';

/** A conversation resource. */
export interface Conversation {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  title?: string | null;
  mode: ConversationMode;
  created_at: string;
  updated_at: string;
}

/** Request to create a conversation. */
export interface CreateConversationRequest {
  project_id?: string | null;
  title?: string | null;
  mode?: ConversationMode;
}

/** Paginated list of conversations. */
export interface ConversationPage {
  items: Conversation[];
  next_cursor?: string | null;
}

// ---------------------------------------------------------------------------
// Message types (per api/openapi.yaml §components/schemas/CreateMessageRequest)
// ---------------------------------------------------------------------------

/** Request to create a message and initiate a model run. */
export interface CreateMessageRequest {
  content: string;
  mode?: ConversationMode;
  retrieval?: {
    enabled?: boolean;
    source_ids?: string[];
  };
}

// ---------------------------------------------------------------------------
// Model-run types (per api/openapi.yaml §components/schemas/ModelRun)
// ---------------------------------------------------------------------------

/** Model-run statuses matching the database enum. */
export type ModelRunStatusApi =
  | 'CREATED'
  | 'STREAMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'INTERRUPTED';

/** A model-run resource returned by the API. */
export interface ModelRun {
  id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id?: string | null;
  status: ModelRunStatusApi;
  provider: string;
  model: string;
  prompt_name: string;
  prompt_version: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
  error_code?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// SSE event types (per docs/04_API_ARCHITECTURE.md#6-sse-event-contract)
// ---------------------------------------------------------------------------

/** SSE event sent when a run transitions to STREAMING. */
export interface SseRunStartedEvent {
  type: 'run.started';
  run_id: string;
  message_id: string;
  sequence: number;
}

/** SSE event carrying a token of generated text. */
export interface SseResponseDeltaEvent {
  type: 'response.delta';
  sequence: number;
  text: string;
}

/** A citation linking a claim to an evidence chunk, exposed via SSE. */
export interface Citation {
  id: string;
  chunk_id: string;
  document_version_id: string;
  source_locator: Record<string, unknown>;
  claim_start: number | null;
  claim_end: number | null;
  claim_text: string;
  verification_status: string;
}

/** Source metadata for a provisional citation event during streaming. */
export interface CitationProvisionalSource {
  chunk_id: string;
  document_version_id: string;
  source_locator: Record<string, unknown>;
}

/** SSE event for a provisional citation reference. */
export interface SseCitationProvisionalEvent {
  type: 'citation.provisional';
  sequence: number;
  citation_id: string;
  source: CitationProvisionalSource;
}

/** SSE event for an approval that blocks further progress. */
export interface SseApprovalRequiredEvent {
  type: 'approval.required';
  sequence: number;
  approval_id: string;
  summary: string;
}

/** SSE event signalling successful completion. */
export interface SseResponseCompletedEvent {
  type: 'response.completed';
  sequence: number;
  message_id: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations: Citation[];
  /** Set to true when no evidence was available to answer the query. */
  insufficient_evidence?: boolean;
}

/** SSE event signalling a failed run. */
export interface SseRunFailedEvent {
  type: 'run.failed';
  sequence: number;
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/** Union of all SSE event types sent to the client. */
export type SseEvent =
  | SseRunStartedEvent
  | SseResponseDeltaEvent
  | SseCitationProvisionalEvent
  | SseApprovalRequiredEvent
  | SseResponseCompletedEvent
  | SseRunFailedEvent;

// ---------------------------------------------------------------------------
// Feedback types (per P3-T08 / FR-FBK-001..004)
// ---------------------------------------------------------------------------

/** Feedback categories matching the database feedback_category enum. */
export type FeedbackCategory =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'INCORRECT'
  | 'INCOMPLETE'
  | 'CITATION_ISSUE'
  | 'STYLE_ISSUE'
  | 'UNSAFE'
  | 'FREE_TEXT';

/** Request to submit feedback against a message. */
export interface CreateFeedbackRequest {
  category: FeedbackCategory;
  model_run_id?: string | null;
  correction?: string | null;
  notes?: string | null;
  suggested_failure_class?: string | null;
  classification_confidence?: number | null;
  /**
   * Retrieval trace IDs that contributed evidence to the model's answer.
   * Application-layer validated against `model_run_retrieval_traces`.
   * Optional; omitted when the user does not have trace data.
   */
  retrieval_trace_ids?: string[] | null;
}

/**
 * A failure-classification suggestion computed by the classifier.
 *
 * Per FR-FBK-003: stored as a suggestion with confidence.
 * Per FR-FBK-004: never auto-applied to production behavior.
 */
export interface FeedbackSuggestion {
  /** Failure class code, or null when the feedback does not imply a failure. */
  category: string | null;
  /** Confidence in [0, 1]. 0 when `category` is null. */
  confidence: number;
  /** Human-readable rationale for the suggestion. */
  rationale: string;
}

/** A feedback resource. */
export interface Feedback {
  id: string;
  workspace_id: string;
  message_id: string;
  model_run_id: string | null;
  submitted_by: string;
  category: FeedbackCategory;
  correction: string | null;
  notes: string | null;
  suggested_failure_class: string | null;
  classification_confidence: number | null;
  /** Retrieval trace IDs linked to this feedback. */
  retrieval_trace_ids: string[];
  created_at: string;
}

/**
 * Submission response: the feedback resource plus the classifier
 * suggestion that was stored on the row.
 */
export interface FeedbackSubmission extends Feedback {
  suggestion: FeedbackSuggestion;
}
