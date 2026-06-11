// ---------------------------------------------------------------------------
// Chunking strategy types — deterministic chunk generation with provenance
// ---------------------------------------------------------------------------
// Per P2-T05: Chunk boundaries are deterministic for identical normalized
// input and pipeline version. Every chunk maps to an exact document-version
// locator. Overlap and max size are configurable and versioned. Duplicate
// identical chunks are detectable via content_hash without losing source
// relationships.
// ---------------------------------------------------------------------------

import type { Locator } from '../parsing/types.js';

// ---------------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------------

/**
 * A single retrieval chunk produced by the chunking strategy.
 *
 * Every chunk is tied to its source document version via `documentVersionId`
 * and carries a content hash for cross-document deduplication. The locator
 * references the starting structural element; the heading path captures the
 * full hierarchical context.
 */
export interface Chunk {
  /** Zero-based ordinal within the document version. */
  readonly ordinal: number;
  /** The chunk's plain-text content. */
  readonly content: string;
  /** SHA-256 hex digest of `content` for deduplication. */
  readonly contentHash: string;
  /** The starting locator for this chunk (e.g. the paragraph or heading where it begins). */
  readonly locator: Locator;
  /** Hierarchical heading path at the chunk's position (shallowest first). */
  readonly headingPath: string[];
  /** Approximate token count (estimated from character count). */
  readonly tokenCount?: number;
}

// ---------------------------------------------------------------------------
// Chunking options
// ---------------------------------------------------------------------------

/**
 * Configuration for the chunking strategy.
 *
 * All options are versioned — changes produce a new `strategyVersion` so
 * re-chunking with different settings creates new chunk artefacts rather
 * than silently replacing existing ones.
 */
export interface ChunkingOptions {
  /** Maximum characters per chunk. Content is split when this threshold is exceeded. */
  readonly maxChunkSize: number;
  /** Characters of overlap between consecutive chunks (preserves context across boundaries). */
  readonly overlapChars: number;
  /**
   * Whether to split chunks at paragraph boundaries (true) or at any character
   * position (false). Paragraph-aware splitting produces more readable chunks.
   */
  readonly splitAtParagraphBoundaries: boolean;
  /**
   * Stable identifier for this chunking configuration. Used as the
   * `chunking_version` column value so different chunking configs
   * produce separate artefacts.
   */
  readonly strategyVersion: string;
}

/**
 * Default chunking options used when none are specified.
 */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxChunkSize: 1500,
  overlapChars: 200,
  splitAtParagraphBoundaries: true,
  strategyVersion: 'v1-default',
};

// ---------------------------------------------------------------------------
// Chunking strategy contract
// ---------------------------------------------------------------------------

/**
 * Input to a chunking operation.
 */
export interface ChunkingInput {
  /** The full normalized document text. */
  readonly text: string;
  /** Structural locators from the parsing stage. */
  readonly locators: readonly Locator[];
  /** Chunking configuration. */
  readonly options: ChunkingOptions;
}

/**
 * Result of a chunking operation.
 */
export interface ChunkingResult {
  /** Generated chunks in ordinal order. */
  readonly chunks: Chunk[];
  /** The strategy version used (from options). */
  readonly strategyVersion: string;
  /** Metadata about the chunking operation. */
  readonly metadata: ChunkingMetadata;
}

/**
 * Operational metadata for observability.
 */
export interface ChunkingMetadata {
  /** Number of chunks produced. */
  readonly chunkCount: number;
  /** Total characters chunked. */
  readonly totalCharacters: number;
  /** Average chunk size in characters. */
  readonly averageChunkSize: number;
  /** Number of heading paths represented. */
  readonly headingPathCount: number;
}

/**
 * A chunking strategy transforms parsed document text and locators into
 * retrieval-optimized chunks.
 *
 * Implementations MUST be deterministic: calling `chunk` with identical
 * inputs MUST produce identical outputs. The strategy version from options
 * is embedded in the result so consumers can validate consistency.
 */
export interface ChunkingStrategy {
  /** Stable identifier for this strategy implementation. */
  readonly id: string;

  /**
   * Generate chunks from parsed document input.
   *
   * @param input - Normalized text, locators, and chunking options.
   * @returns Ordered chunks with provenance metadata.
   */
  chunk(input: ChunkingInput): ChunkingResult;
}
