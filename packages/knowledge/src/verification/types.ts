// ---------------------------------------------------------------------------
// Citation verification types — deterministic post-persistence validation
// ---------------------------------------------------------------------------
// P3-T07: Validates every persisted citation against chunk existence, document
// version lifecycle, locator boundaries, and workspace integrity. No model
// calls — all checks are deterministic DB queries and in-memory comparisons.
//
// Per FR-CIT-002: The citation verifier MUST confirm the cited source was in
// the generation evidence set.
// Per FR-CIT-003: The verifier MUST reject locators that exceed source
// boundaries or reference superseded/deleted content.
// Per FR-CIT-005: Unsupported claims SHOULD be removed, qualified, or marked
// as inference before final presentation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Verifiable citation
// ---------------------------------------------------------------------------

/**
 * Minimal citation shape passed into the verifier.
 * The orchestrator builds this from persisted CitationRow / Citation data.
 */
export interface VerifiableCitation {
  /** Unique citation identifier. */
  readonly id: string;
  /** The chunk ID this citation references. */
  readonly chunkId: string;
  /** The document version ID at time of citation. */
  readonly documentVersionId: string;
  /** Structural locator within the document version. */
  readonly sourceLocator: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Verification status
// ---------------------------------------------------------------------------

/**
 * Terminal verification states for a citation.
 *
 * PENDING → VALID | INVALID_*
 *
 * Transitions are owned exclusively by P3-T07's verifier.
 */
export type VerificationStatus =
  | 'PENDING'
  | 'VALID'
  | 'INVALID_CHUNK_MISSING'
  | 'INVALID_VERSION_STALE'
  | 'INVALID_LOCATOR_OUT_OF_BOUNDS'
  | 'INVALID_CROSS_WORKSPACE'
  | 'INVALID_EVIDENCE_MISSING';

/**
 * Granular reason codes for verification failures.
 */
export type VerificationReasonCode =
  | 'CHUNK_NOT_FOUND'
  | 'CHUNK_WRONG_WORKSPACE'
  | 'VERSION_NOT_FOUND'
  | 'VERSION_NOT_READY'
  | 'VERSION_SUPERSEDED'
  | 'VERSION_DELETED'
  | 'VERSION_FAILED'
  | 'LOCATOR_PAGE_EXCEEDS_PAGE_COUNT'
  | 'LOCATOR_OFFSET_EXCEEDS_CHARACTER_COUNT'
  | 'LOCATOR_MISSING'
  | 'CITATION_NOT_IN_EVIDENCE_SET'
  | 'CHUNK_VERSION_MISMATCH';

// ---------------------------------------------------------------------------
// Per-citation result
// ---------------------------------------------------------------------------

/**
 * Verification outcome for a single citation.
 */
export interface CitationVerification {
  /** The citation record ID. */
  readonly citationId: string;
  /** The chunk ID being cited. */
  readonly chunkId: string;
  /** The document version ID at time of citation. */
  readonly documentVersionId: string;
  /** Terminal verification status. */
  readonly status: VerificationStatus;
  /** Human-readable reason when status is not VALID. */
  readonly reason?: string;
  /** Machine-readable reason code when status is not VALID. */
  readonly reasonCode?: VerificationReasonCode;
}

// ---------------------------------------------------------------------------
// Aggregate verification result
// ---------------------------------------------------------------------------

/**
 * Outcome of verifying a batch of citations.
 */
export interface VerificationResult {
  /** The model run these citations belong to. */
  readonly modelRunId: string;
  /** Whether all citations passed verification. */
  readonly allValid: boolean;
  /** The verified count. */
  readonly totalCitations: number;
  /** The count of citations that passed. */
  readonly validCount: number;
  /** The count of citations that failed. */
  readonly invalidCount: number;
  /** Per-citation verification outcomes. */
  readonly results: readonly CitationVerification[];
}

// ---------------------------------------------------------------------------
// Verifier input
// ---------------------------------------------------------------------------

/**
 * Input to the verifier — the citations to verify and the evidence set
 * used during generation.
 */
export interface VerifierInput {
  /** The workspace ID for scoping all queries. */
  readonly workspaceId: string;
  /** The model run ID. */
  readonly modelRunId: string;
  /** The persisted citations to verify. */
  readonly citations: readonly VerifiableCitation[];
  /** The evidence map from generation-time retrieval (chunkId → evidence). */
  readonly evidenceMap: ReadonlyMap<string, {
    readonly chunkId: string;
    readonly documentVersionId: string;
  }>;
}
