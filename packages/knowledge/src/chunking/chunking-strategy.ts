// ---------------------------------------------------------------------------
// Default chunking strategy — paragraph-aware, heading-tracking, overlapping
// ---------------------------------------------------------------------------
// Implements a deterministic chunking algorithm that:
//   - Splits text at paragraph boundaries (or character positions)
//   - Tracks heading hierarchy via locators
//   - Applies configurable overlap between consecutive chunks
//   - Computes SHA-256 content hashes for deduplication
//   - Estimates token counts
//
// Determinism guarantee: identical (text, locators, options) → identical chunks.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import type {
  Chunk,
  ChunkingInput,
  ChunkingOptions,
  ChunkingResult,
  ChunkingStrategy,
} from './types.js';
import { DEFAULT_CHUNKING_OPTIONS } from './types.js';
import type { Locator } from '../parsing/types.js';

// ---------------------------------------------------------------------------
// Strategy implementation
// ---------------------------------------------------------------------------

/**
 * Creates the default chunking strategy.
 *
 * The strategy produces chunks that are:
 * - **Paragraph-aware**: prefers splitting at paragraph breaks
 * - **Heading-tracking**: captures the full heading hierarchy for each chunk
 * - **Overlapping**: consecutive chunks share `overlapChars` characters
 * - **Content-hashed**: each chunk's content is SHA-256 hashed for dedup
 */
export function createDefaultChunkingStrategy(): ChunkingStrategy {
  return {
    id: 'default-chunking-v1',

    chunk(input: ChunkingInput): ChunkingResult {
      const options = { ...DEFAULT_CHUNKING_OPTIONS, ...input.options };
      return chunkDocument(input.text, input.locators, options);
    },
  };
}

/**
 * Singleton default strategy instance.
 */
export const defaultChunkingStrategy: ChunkingStrategy = createDefaultChunkingStrategy();

// ---------------------------------------------------------------------------
// Paragraph splitting
// ---------------------------------------------------------------------------

/**
 * Splits text into paragraphs, returning each paragraph with its character
 * offset range [start, end) within the original text.
 */
interface ParagraphSpan {
  /** Paragraph text (without trailing newlines). */
  text: string;
  /** Start character offset in the source text. */
  start: number;
  /** End character offset in the source text (exclusive). */
  end: number;
}

function splitParagraphs(text: string): ParagraphSpan[] {
  if (text.length === 0) return [];

  const spans: ParagraphSpan[] = [];
  // Split on one or more newlines; capture the separator positions
  let pos = 0;
  const len = text.length;

  while (pos < len) {
    // Find the next newline
    const nlPos = text.indexOf('\n', pos);
    if (nlPos === -1) {
      // Last paragraph: from pos to end
      const para = text.slice(pos).trimEnd();
      if (para.length > 0) {
        spans.push({ text: para, start: pos, end: len });
      }
      break;
    }

    // Extract paragraph (exclude the newline)
    const para = text.slice(pos, nlPos).trimEnd();
    if (para.length > 0) {
      spans.push({ text: para, start: pos, end: nlPos });
    }

    // Skip consecutive newlines
    pos = nlPos;
    while (pos < len && text[pos] === '\n') {
      pos++;
    }
  }

  return spans;
}

// ---------------------------------------------------------------------------
// Heading path resolution
// ---------------------------------------------------------------------------

/**
 * Builds a heading path for a given character offset by walking the
 * heading hierarchy from the locators list.
 *
 * Returns headings in shallowest-first order (H1, H2, H3).
 */
function resolveHeadingPath(offset: number, locators: readonly Locator[]): string[] {
  const activeHeadings: Locator[] = [];

  for (const loc of locators) {
    if (loc.type !== 'heading') continue;

    // Only consider headings that start at or before our offset
    if (loc.startOffset > offset) continue;

    // Remove headings at the same or deeper level
    while (
      activeHeadings.length > 0 &&
      (activeHeadings[activeHeadings.length - 1]!.level ?? 0) >= (loc.level ?? 1)
    ) {
      activeHeadings.pop();
    }

    activeHeadings.push(loc);
  }

  return activeHeadings
    .map((h) => h.title)
    .filter((t): t is string => t !== undefined && t.length > 0);
}

// ---------------------------------------------------------------------------
// Locator resolution
// ---------------------------------------------------------------------------

/**
 * Finds the primary locator for a given character offset.
 *
 * Returns the deepest structural locator that contains the offset.
 * Prefers: heading > paragraph > list_item > section > line > page.
 */
function resolveLocator(offset: number, locators: readonly Locator[]): Locator | undefined {
  // Priority order for locator types
  const priority: Record<string, number> = {
    heading: 10,
    paragraph: 9,
    list_item: 8,
    list: 7,
    table: 6,
    line: 5,
    section: 4,
    page: 3,
  };

  let best: Locator | undefined;

  for (const loc of locators) {
    if (loc.startOffset <= offset && loc.endOffset > offset) {
      const score = priority[loc.type] ?? 0;
      const bestScore = best ? (priority[best.type] ?? 0) : -1;
      if (score > bestScore) {
        best = loc;
      }
    }
  }

  // Fallback: find the nearest preceding locator
  if (!best && locators.length > 0) {
    let nearest: Locator | undefined;
    let nearestDist = Infinity;
    for (const loc of locators) {
      const dist = offset - loc.startOffset;
      if (dist >= 0 && dist < nearestDist) {
        nearestDist = dist;
        nearest = loc;
      }
    }
    best = nearest;
  }

  return best;
}

// ---------------------------------------------------------------------------
// Content hashing
// ---------------------------------------------------------------------------

/**
 * Computes a SHA-256 hex digest of the given content for deduplication.
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Approximates a token count from character count.
 *
 * Uses a simple heuristic: ~4 characters per token for English text.
 * This is intentionally rough — the exact count depends on the tokenizer.
 */
function estimateTokenCount(charCount: number): number {
  return Math.max(1, Math.ceil(charCount / 4));
}

// ---------------------------------------------------------------------------
// Core chunking algorithm
// ---------------------------------------------------------------------------

/**
 * Generates chunks from document text and locators using the given options.
 *
 * This is the core deterministic algorithm. It is separated from the
 * strategy wrapper to make unit testing straightforward.
 */
function chunkDocument(
  text: string,
  locators: readonly Locator[],
  options: ChunkingOptions,
): ChunkingResult {
  const { maxChunkSize, overlapChars, splitAtParagraphBoundaries, strategyVersion } = options;

  const chunks: Chunk[] = [];
  let ordinal = 0;
  let totalChars = 0;

  if (text.length === 0) {
    return {
      chunks: [],
      strategyVersion,
      metadata: {
        chunkCount: 0,
        totalCharacters: 0,
        averageChunkSize: 0,
        headingPathCount: 0,
      },
    };
  }

  if (splitAtParagraphBoundaries) {
    // Paragraph-aware chunking
    const paragraphs = splitParagraphs(text);

    let buffer = '';
    let bufferStart = 0;
    let overlapBuffer = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]!;

      // Check if adding this paragraph would exceed max size
      const candidateSize = buffer.length + (buffer.length > 0 ? 1 : 0) + para.text.length; // +1 for newline

      if (candidateSize > maxChunkSize && buffer.length > 0) {
        // Emit the current buffer as a chunk
        const content = buffer;
        const contentHash = computeContentHash(content);
        const headingPath = resolveHeadingPath(bufferStart, locators);
        const locator = resolveLocator(bufferStart, locators);

        chunks.push({
          ordinal: ordinal++,
          content,
          contentHash,
          locator: locator ?? createFallbackLocator(bufferStart, bufferStart + content.length),
          headingPath,
          tokenCount: estimateTokenCount(content.length),
        });

        totalChars += content.length;

        // Prepare overlap: keep last `overlapChars` characters from the emitted chunk
        if (overlapChars > 0) {
          overlapBuffer = content.slice(-overlapChars);
        } else {
          overlapBuffer = '';
        }

        buffer = overlapBuffer + para.text;
        bufferStart = Math.max(0, para.start - overlapChars);
      } else {
        // Append paragraph to buffer
        if (buffer.length > 0) {
          buffer += '\n';
        }
        if (buffer.length === 0) {
          bufferStart = para.start;
        }
        buffer += para.text;
      }
    }

    // Emit final chunk
    if (buffer.length > 0) {
      const content = buffer;
      const contentHash = computeContentHash(content);
      const headingPath = resolveHeadingPath(bufferStart, locators);
      const locator = resolveLocator(bufferStart, locators);

      chunks.push({
        ordinal: ordinal++,
        content,
        contentHash,
        locator: locator ?? createFallbackLocator(bufferStart, bufferStart + content.length),
        headingPath,
        tokenCount: estimateTokenCount(content.length),
      });

      totalChars += content.length;
    }
  } else {
    // Character-based chunking (no paragraph awareness)
    let pos = 0;
    const textLen = text.length;

    while (pos < textLen) {
      const chunkEnd = Math.min(pos + maxChunkSize, textLen);
      let content = text.slice(pos, chunkEnd);

      // Apply overlap for next chunk (not the first)
      if (pos > 0 && overlapChars > 0) {
        const overlapStart = Math.max(0, pos - overlapChars);
        content = text.slice(overlapStart, chunkEnd);
        pos = overlapStart; // adjust for correct heading/locator tracking
      }

      const contentHash = computeContentHash(content);
      const headingPath = resolveHeadingPath(pos, locators);
      const locator = resolveLocator(pos, locators);

      chunks.push({
        ordinal: ordinal++,
        content,
        contentHash,
        locator: locator ?? createFallbackLocator(pos, pos + content.length),
        headingPath,
        tokenCount: estimateTokenCount(content.length),
      });

      totalChars += content.length;
      pos = chunkEnd;
    }
  }

  // Collect unique heading paths for metadata
  const headingPaths = new Set<string>();
  for (const chunk of chunks) {
    if (chunk.headingPath.length > 0) {
      headingPaths.add(chunk.headingPath.join(' > '));
    }
  }

  return {
    chunks,
    strategyVersion,
    metadata: {
      chunkCount: chunks.length,
      totalCharacters: totalChars,
      averageChunkSize: chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0,
      headingPathCount: headingPaths.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback locator
// ---------------------------------------------------------------------------

/**
 * Creates a minimal locator when no structural locator covers the chunk's
 * starting offset.
 */
function createFallbackLocator(start: number, end: number): Locator {
  return {
    type: 'paragraph',
    ordinal: 0,
    startOffset: start,
    endOffset: end,
  };
}
