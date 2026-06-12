// ---------------------------------------------------------------------------
// Retrieval types — authorized hybrid retrieval (P2-T07)
// ---------------------------------------------------------------------------
// Per docs/02_ARCHITECTURE.md#8-retrieval-architecture:
//   Each result MUST contain: workspace/project IDs, source, document,
//   document-version IDs, chunk ID, source locator, text span,
//   lexical/vector/fused scores, retrieval configuration version,
//   retrieval trace ID.
// ---------------------------------------------------------------------------

import type { SensitivityClass } from '../types.js';

// ---------------------------------------------------------------------------
// Retrieval query
// ---------------------------------------------------------------------------

/**
 * Input to a retrieval request. All filterable fields are optional;
 * the service applies authorization-mandated workspace/project scoping.
 */
export interface RetrievalQuery {
  /** The natural-language query text. */
  readonly queryText: string;

  /** Workspace scope (required — caller enforces auth). */
  readonly workspaceId: string;

  /** Optional project scope for cross-project restriction. */
  readonly projectId?: string;

  /** Maximum number of fused results to return (default 10). */
  readonly maxResults?: number;

  /** Maximum number of lexical candidates to retrieve (default 20). */
  readonly lexicalCandidateLimit?: number;

  /** Maximum number of vector candidates to retrieve (default 20). */
  readonly vectorCandidateLimit?: number;

  /** Optional sensitivity class filter. */
  readonly sensitivity?: SensitivityClass;

  /** Optional source ID filter. */
  readonly sourceId?: string;

  /** Optional list of allowed document IDs (explicit access list). */
  readonly allowedDocumentIds?: readonly string[];

  /** Optional list of allowed project IDs. Falls back to query.projectId. */
  readonly allowedProjectIds?: readonly string[];

  /** Whether to include superseded/deleted versions (false for normal retrieval). */
  readonly includeHistorical?: boolean;

  /**
   * Minimum fused score threshold (0–1). Results below this are dropped.
   * Default 0.0 (no threshold).
   */
  readonly scoreThreshold?: number;
}

// ---------------------------------------------------------------------------
// Retrieval result
// ---------------------------------------------------------------------------

/**
 * A single fused retrieval result. Always tied to a document version,
 * chunk, and retrieval trace.
 */
export interface RetrievalResult {
  /** Workspace that owns this content. */
  readonly workspaceId: string;

  /** Project that owns this content, if any. */
  readonly projectId: string | null;

  /** Source identifier. */
  readonly sourceId: string | null;

  /** Logical document identifier. */
  readonly documentId: string;

  /** Specific document version identifier. */
  readonly documentVersionId: string;

  /** Chunk identifier. */
  readonly chunkId: string;

  /** Structural locator within the document version. */
  readonly locator: Record<string, unknown>;

  /** Relevant text span from the chunk. */
  readonly text: string;

  /** Normalized lexical score (0–1). */
  readonly lexicalScore: number | null;

  /** Normalized vector/cosine similarity score (0–1). */
  readonly vectorScore: number | null;

  /** Fused composite score (0–1). */
  readonly fusedScore: number;

  /** Retrieval configuration version used. */
  readonly retrievalConfigVersion: string;

  /** Retrieval trace identifier for linking to the trace record. */
  readonly retrievalTraceId: string;

  /** Content hash for deduplication tracking. */
  readonly contentHash: string;
}

// ---------------------------------------------------------------------------
// Retrieval candidate (internal)
// ---------------------------------------------------------------------------

/**
 * An internal candidate from lexical or vector search before fusion.
 */
export interface RetrievalCandidate {
  /** Chunk identifier. */
  readonly chunkId: string;

  /** Workspace identifier. */
  readonly workspaceId: string;

  /** Project identifier, if any. */
  readonly projectId: string | null;

  /** Source identifier, if any. */
  readonly sourceId: string | null;

  /** Document identifier. */
  readonly documentId: string;

  /** Document version identifier. */
  readonly documentVersionId: string;

  /** Locator JSON (from DB — may be any shape depending on pipeline version). */
  readonly locator: Record<string, unknown>;

  /** Chunk text content. */
  readonly content: string;

  /** Content hash. */
  readonly contentHash: string;

  /** Lexical rank-based score (null if not in lexical results). */
  readonly lexicalScore: number | null;

  /** Vector distance-based score (null if not in vector results). */
  readonly vectorScore: number | null;
}

// ---------------------------------------------------------------------------
// Retrieval configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for a retrieval run. Persisted with traces for audit.
 */
export interface RetrievalConfig {
  /** Stable name for this configuration (e.g. "default-hybrid"). */
  readonly name: string;

  /** Version of this configuration. */
  readonly version: string;

  /** Reciprocal-rank fusion constant `k` (default 60). */
  readonly rrfK: number;

  /** Whether lexical search is enabled. */
  readonly lexicalEnabled: boolean;

  /** Whether vector search is enabled. */
  readonly vectorEnabled: boolean;

  /** Embedding model used for vector search. */
  readonly embeddingModel?: string;

  /** Embedding version used for vector search. */
  readonly embeddingVersion?: string;
}

// ---------------------------------------------------------------------------
// Retrieval trace
// ---------------------------------------------------------------------------

/**
 * Persistent record of a retrieval execution.
 */
export interface RetrievalTrace {
  /** Unique trace identifier. */
  readonly id: string;

  /** Workspace scope. */
  readonly workspaceId: string;

  /** Project scope, if any. */
  readonly projectId: string | null;

  /** User who requested the retrieval. */
  readonly requestedBy: string;

  /** Original query text. */
  readonly queryText: string;

  /** Applied filters (workspace, project, sensitivity, etc.). */
  readonly filters: Record<string, unknown>;

  /** Retrieval config ID used. */
  readonly retrievalConfigId: string;

  /** Number of fused results returned. */
  readonly resultCount: number;

  /** Total latency in milliseconds. */
  readonly latencyMs: number;

  /** When the trace was created. */
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Retrieval response
// ---------------------------------------------------------------------------

/**
 * Complete response from a retrieval call.
 */
export interface RetrievalResponse {
  /** Ordered fused results. */
  readonly results: readonly RetrievalResult[];

  /** Trace identifier for audit/debug. */
  readonly traceId: string;

  /** Total number of lexical candidates before fusion. */
  readonly lexicalCandidateCount: number;

  /** Total number of vector candidates before fusion. */
  readonly vectorCandidateCount: number;

  /** Total fused results before deduplication. */
  readonly fusedCount: number;

  /** Total latency in milliseconds. */
  readonly latencyMs: number;
}
