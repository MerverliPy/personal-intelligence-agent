// ---------------------------------------------------------------------------
// Citation domain types — claim-to-evidence link models
// ---------------------------------------------------------------------------
// Per FR-CIT-001: Each citation MUST link a generated claim to one or more
// retrieved chunk spans.
// ---------------------------------------------------------------------------

/** A single citation linking a claim span to an evidence chunk. */
export interface Citation {
  /** Unique citation identifier. */
  readonly id: string;
  /** The chunk this citation references. */
  readonly chunkId: string;
  /** The document version at time of citation. */
  readonly documentVersionId: string;
  /** Structural locator within the document version. */
  readonly sourceLocator: Record<string, unknown>;
  /** Start character offset of the claim in the assistant message content. */
  readonly claimStart: number | null;
  /** End character offset of the claim in the assistant message content. */
  readonly claimEnd: number | null;
  /** The text of the cited claim. */
  readonly claimText: string;
  /** Verification status — set to PENDING on creation (P3-T07 owns transitions). */
  readonly verificationStatus: string;
}

/** Input for creating a citation in the database. */
export interface CreateCitationInput {
  readonly workspaceId: string;
  readonly modelRunId: string;
  readonly assistantMessageId: string;
  readonly chunkId: string;
  readonly documentVersionId: string;
  readonly sourceLocator: Record<string, unknown>;
  readonly claimStart: number | null;
  readonly claimEnd: number | null;
  readonly claimText: string;
}

/** An evidence item keyed for lookup during citation validation. */
export interface EvidenceLookup {
  readonly chunkId: string;
  readonly documentVersionId: string;
  readonly locator: Record<string, unknown>;
  readonly retrievalTraceId: string;
}

/** Result of building citations from model output text. */
export interface CitationBuildResult {
  /** Validated citation records ready for persistence. */
  readonly citations: readonly CreateCitationInput[];
  /** The model output text with all citation markers stripped. */
  readonly cleanedText: string;
}
