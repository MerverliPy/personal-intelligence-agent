// ---------------------------------------------------------------------------
// Streaming citation parser — detects citation markers incrementally
// ---------------------------------------------------------------------------
// Processes model output deltas in real time during streaming generation.
// When a complete [cite:<chunk-id>] marker is detected, yields a provisional
// citation event. Handles partial markers that span multiple deltas.
// ---------------------------------------------------------------------------

import type { EvidenceLookup } from './types.js';

/** A provisional citation ready to be emitted as an SSE event. */
export interface ProvisionalCitation {
  /** The chunk this citation references. */
  readonly chunkId: string;
  /** Document version at time of citation. */
  readonly documentVersionId: string;
  /** Structural locator within the document version. */
  readonly sourceLocator: Record<string, unknown>;
  /** Provisional claim text leading up to this marker. */
  readonly claimText: string;
  /** Character offset of the claim start in the accumulated output. */
  readonly claimStart: number;
}

/** Regex for detecting a complete citation marker. */
const CITE_MARKER_RE = /\[cite:([^\]]+)\]/;

/** Marker prefix that triggers buffer accumulation. */
const MARKER_PREFIX = '[cite:';

/** Maximum buffer size to prevent unbounded accumulation of partial markers. */
const MAX_BUFFER_SIZE = 200;

/**
 * Incrementally parses streaming text deltas to detect complete citation markers.
 *
 * Usage in a streaming loop:
 * ```
 * const parser = new StreamingCitationParser(evidenceMap);
 * for await (const delta of stream) {
 *   for (const citation of parser.feed(delta.text)) {
 *     // emit citation.provisional SSE event
 *   }
 * }
 * // After streaming completes
 * const remaining = parser.flush();
 * // remaining.cleanText is the full cleaned output
 * ```
 */
export class StreamingCitationParser {
  private readonly evidenceMap: ReadonlyMap<string, EvidenceLookup>;
  private buffer = '';
  private totalCleanLength = 0;
  private lastMarkerEnd = 0;
  private currentClaimStart = 0;

  constructor(evidenceMap: ReadonlyMap<string, EvidenceLookup>) {
    this.evidenceMap = evidenceMap;
  }

  /**
   * Feeds a text delta into the parser.
   *
   * @returns Any complete citation markers detected in or spanning this delta.
   */
  feed(delta: string): ProvisionalCitation[] {
    if (delta.length === 0) return [];

    const provisional: ProvisionalCitation[] = [];
    this.buffer += delta;

    // Search for complete marker patterns in the buffer
    let match: RegExpExecArray | null;
    const re = new RegExp(CITE_MARKER_RE.source, 'g');
    re.lastIndex = 0;

    while ((match = re.exec(this.buffer)) !== null) {
      const chunkId = match[1]!;
      const markerStart = match.index;
      const markerEnd = markerStart + match[0].length;

      const evidence = this.evidenceMap.get(chunkId);
      if (evidence) {
        // Extract claim text from the last marker end to this marker start
        const claimText = this.buffer.slice(this.lastMarkerEnd, markerStart).trim();
        provisional.push({
          chunkId,
          documentVersionId: evidence.documentVersionId,
          sourceLocator: evidence.locator,
          claimText,
          claimStart: this.currentClaimStart,
        });

        this.currentClaimStart += claimText.length;
      }

      this.lastMarkerEnd = markerEnd;
    }

    // Trim consumed text from buffer to avoid unbounded growth.
    // Remove everything up to and including fully parsed markers.
    const consumedUpTo = this.lastMarkerEnd;
    if (consumedUpTo > 0) {
      this.buffer = this.buffer.slice(consumedUpTo);
      this.lastMarkerEnd = 0;
    }

    // Prevent unbounded buffer on partial markers
    if (this.buffer.length > MAX_BUFFER_SIZE && !this.buffer.includes(MARKER_PREFIX)) {
      // No partial marker — safe to flush to clean output
      this.totalCleanLength += this.buffer.length;
      this.currentClaimStart += this.buffer.length;
      this.buffer = '';
    }

    return provisional;
  }

  /**
   * Flushes any remaining buffered text after streaming completes.
   *
   * @returns The remaining unmarked text that was buffered.
   */
  flush(): { remainingText: string } {
    const remaining = this.buffer;
    this.buffer = '';
    return { remainingText: remaining };
  }
}
