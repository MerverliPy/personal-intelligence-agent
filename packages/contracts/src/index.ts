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
  if (limit === undefined || limit === null) return DEFAULT_PAGE_LIMIT;
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
