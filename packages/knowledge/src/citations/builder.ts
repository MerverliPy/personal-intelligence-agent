// ---------------------------------------------------------------------------
// Citation builder — parses prompt-based citation markers from model output
// ---------------------------------------------------------------------------
// The model is instructed (via prompt) to emit markers like [cite:<chunk-id>],
// [infer], and [assume] after relevant claims. This builder:
// 1. Extracts markers and their positions.
// 2. Validates cited chunk IDs against the evidence set.
// 3. Strips markers from the display text.
// 4. Produces structured claim-to-evidence links.
// ---------------------------------------------------------------------------

import type { EvidenceLookup, CitationBuildResult, CreateCitationInput } from './types.js';

/** Regex matching a complete citation marker: [cite:<uuid>] */
const CITE_MARKER_RE = /\[cite:([^\]]+)\]/g;

/** Regex matching [infer] markers. */
const INFER_MARKER_RE = /\[infer\]/g;

/** Regex matching [assume] markers. */
const ASSUME_MARKER_RE = /\[assume\]/g;

/** All marker patterns combined for stripping. */
const ALL_MARKERS_RE = /\[cite:[^\]]+\]|\[infer\]|\[assume\]/g;

interface ParsedSpan {
  /** The kind of marker at this position. */
  readonly kind: 'cite' | 'infer' | 'assume';
  /** Character position where the marker starts in the raw text. */
  readonly markerStart: number;
  /** Character position where the marker ends (exclusive). */
  readonly markerEnd: number;
  /** The cited chunk ID (only for 'cite' kind). */
  readonly chunkId?: string;
}

/**
 * Scans raw model output for all marker positions.
 */
function scanMarkers(rawText: string): ParsedSpan[] {
  const spans: ParsedSpan[] = [];

  for (const match of rawText.matchAll(CITE_MARKER_RE)) {
    spans.push({
      kind: 'cite',
      markerStart: match.index!,
      markerEnd: match.index! + match[0].length,
      chunkId: match[1]!,
    });
  }

  for (const match of rawText.matchAll(INFER_MARKER_RE)) {
    spans.push({
      kind: 'infer',
      markerStart: match.index!,
      markerEnd: match.index! + match[0].length,
    });
  }

  for (const match of rawText.matchAll(ASSUME_MARKER_RE)) {
    spans.push({
      kind: 'assume',
      markerStart: match.index!,
      markerEnd: match.index! + match[0].length,
    });
  }

  // Sort by position in the text
  return spans.sort((a, b) => a.markerStart - b.markerStart);
}

/**
 * Strips all markers from the text, producing clean display output.
 */
function stripMarkers(rawText: string): string {
  return rawText.replace(ALL_MARKERS_RE, '').replace(/ {2,}/g, ' ').trim();
}

/**
 * Extracts claim text between two marker positions.
 */
function extractClaimText(rawText: string, start: number, end: number): string {
  return rawText.slice(start, end).trim();
}

/**
 * Builds citations from a model's raw output and an evidence lookup map.
 *
 * @param rawText - The full model response text with citation markers.
 * @param evidenceMap - Map of chunkId → EvidenceLookup for validation.
 * @param buildContext - workspace, run, and message IDs for citation records.
 * @returns Validated citations and cleaned display text.
 */
export function buildCitations(
  rawText: string,
  evidenceMap: ReadonlyMap<string, EvidenceLookup>,
  buildContext: {
    readonly workspaceId: string;
    readonly modelRunId: string;
    readonly assistantMessageId: string;
  },
): CitationBuildResult {
  const markers = scanMarkers(rawText);
  const citations: CreateCitationInput[] = [];
  let claimStart = 0;

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const nextMarkerStart = i + 1 < markers.length ? markers[i + 1]!.markerStart : rawText.length;

    // Extract the claim text between this marker's end and the next marker's start
    const claimTextStart = marker.markerEnd;
    const claimTextEnd = nextMarkerStart;
    const claimText = extractClaimText(rawText, claimTextStart, claimTextEnd);

    if (marker.kind === 'cite' && marker.chunkId) {
      const evidence = evidenceMap.get(marker.chunkId);
      if (evidence) {
        citations.push({
          workspaceId: buildContext.workspaceId,
          modelRunId: buildContext.modelRunId,
          assistantMessageId: buildContext.assistantMessageId,
          chunkId: marker.chunkId,
          documentVersionId: evidence.documentVersionId,
          sourceLocator: evidence.locator,
          claimStart,
          claimEnd: claimStart + claimText.length,
          claimText,
        });
        claimStart += claimText.length;
      }
      // Invalid chunk IDs (not in evidence set) are silently dropped per acceptance criteria
    }
  }

  return {
    citations,
    cleanedText: stripMarkers(rawText),
  };
}

/**
 * Builds an evidence lookup map from an iterable of evidence items.
 */
export function buildEvidenceMap(
  evidence: ReadonlyArray<{
    readonly chunkId: string;
    readonly documentVersionId: string;
    readonly locator: Record<string, unknown>;
    readonly retrievalTraceId: string;
  }>,
): Map<string, EvidenceLookup> {
  const map = new Map<string, EvidenceLookup>();
  for (const item of evidence) {
    map.set(item.chunkId, {
      chunkId: item.chunkId,
      documentVersionId: item.documentVersionId,
      locator: item.locator,
      retrievalTraceId: item.retrievalTraceId,
    });
  }
  return map;
}
