// ---------------------------------------------------------------------------
// Structured answer types — models answer parts distinguished per PR-012
// ---------------------------------------------------------------------------
// PR-012: The system MUST distinguish sourced claims, inference, assumptions,
// estimates, and recommendations.
// PR-014: The system MUST report insufficient evidence rather than fabricate support.
// ---------------------------------------------------------------------------

/** A reference to a single citation within a sourced claim. */
export interface CitationRef {
  /** The citation record ID. */
  readonly citationId: string;
  /** Chunk that supports this claim. */
  readonly chunkId: string;
}

/** A factual claim grounded in one or more evidence citations. */
export interface SourcedClaim {
  readonly kind: 'sourced';
  readonly text: string;
  readonly citations: readonly CitationRef[];
}

/** A reasoned conclusion beyond explicit evidence. */
export interface Inference {
  readonly kind: 'inference';
  readonly text: string;
}

/** An unverified statement assumed to be true. */
export interface Assumption {
  readonly kind: 'assumption';
  readonly text: string;
}

/** A quantitative or probabilistic estimate. */
export interface Estimate {
  readonly kind: 'estimate';
  readonly text: string;
}

/** An actionable suggestion or recommendation. */
export interface Recommendation {
  readonly kind: 'recommendation';
  readonly text: string;
}

/** A part of a structured answer — sourced claim or unsupported part. */
export type AnswerPart = SourcedClaim | Inference | Assumption | Estimate | Recommendation;

/** A structured answer containing distinguished claim categories. */
export interface StructuredAnswer {
  readonly kind: 'structured';
  readonly parts: readonly AnswerPart[];
}

/** The system could not find sufficient evidence to answer. */
export interface InsufficientEvidence {
  readonly kind: 'insufficient-evidence';
  readonly text: string;
}

/** The top-level answer type — either a structured answer with citations or insufficient evidence. */
export type Answer = StructuredAnswer | InsufficientEvidence;
