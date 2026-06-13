// ---------------------------------------------------------------------------
// Citation builder tests — marker parsing, validation, stripping
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildCitations,
  buildEvidenceMap,
  StreamingCitationParser,
} from '../src/citations/index.js';
import type { EvidenceLookup, CitationBuildResult } from '../src/citations/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvidence(
  chunkId: string,
  overrides: Partial<EvidenceLookup> = {},
): {
  chunkId: string;
  documentVersionId: string;
  locator: Record<string, unknown>;
  retrievalTraceId: string;
} {
  return {
    chunkId,
    documentVersionId: `dv-${chunkId}`,
    locator: { page: 1, line: 10 },
    retrievalTraceId: `trace-${chunkId}`,
    ...overrides,
  };
}

const buildContext = {
  workspaceId: 'ws-1',
  modelRunId: 'run-1',
  assistantMessageId: 'msg-1',
};

// ---------------------------------------------------------------------------
// buildCitations
// ---------------------------------------------------------------------------

describe('buildCitations', () => {
  it('parses a single cite marker and validates against evidence', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc')]);
    const raw = 'The sky is blue [cite:chk-abc]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.chunkId).toBe('chk-abc');
    expect(result.citations[0]!.documentVersionId).toBe('dv-chk-abc');
    expect(result.cleanedText).toBe('The sky is blue');
  });

  it('parses multiple cite markers in one response', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc'), makeEvidence('chk-def')]);
    const raw = 'Claim one [cite:chk-abc] Claim two [cite:chk-def]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.chunkId).toBe('chk-abc');
    expect(result.citations[1]!.chunkId).toBe('chk-def');
    expect(result.cleanedText).toBe('Claim one Claim two');
  });

  it('drops citations for chunk IDs not in the evidence set', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc')]);
    const raw = 'Valid cite [cite:chk-abc] Invalid cite [cite:chk-xyz]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.chunkId).toBe('chk-abc');
    expect(result.cleanedText).toBe('Valid cite Invalid cite');
  });

  it('handles response with no markers', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc')]);
    const raw = 'Just a plain response with no citations.';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(0);
    expect(result.cleanedText).toBe(raw);
  });

  it('handles empty input', () => {
    const evidenceMap = buildEvidenceMap([]);
    const result = buildCitations('', evidenceMap, buildContext);

    expect(result.citations).toHaveLength(0);
    expect(result.cleanedText).toBe('');
  });

  it('strips [infer] and [assume] markers (no citations created)', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc')]);
    const raw = 'Sourced claim [cite:chk-abc] An inference [infer] An assumption [assume]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(1);
    expect(result.cleanedText).not.toContain('[cite:');
    expect(result.cleanedText).not.toContain('[infer]');
    expect(result.cleanedText).not.toContain('[assume]');
  });

  it('extracts claim text correctly between markers', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-1'), makeEvidence('chk-2')]);
    const raw = 'First sentence with claim. [cite:chk-1] Second claim text. [cite:chk-2]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.claimText).toBe('Second claim text.');
    expect(result.citations[1]!.claimText).toBe('');
  });

  it('extracts claim text for trailing text after last marker', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-1')]);
    const raw = 'Text before. [cite:chk-1] Text after.';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.claimText).toBe('Text after.');
  });

  it('ignores malformed marker brackets', () => {
    const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc')]);
    const raw = 'Valid cite [cite:chk-abc] and [brackets with no cite]';

    const result = buildCitations(raw, evidenceMap, buildContext);

    expect(result.citations).toHaveLength(1);
    expect(result.cleanedText).not.toContain('[cite:');
    expect(result.cleanedText).toContain('[brackets with no cite]');
  });
});

// ---------------------------------------------------------------------------
// buildEvidenceMap
// ---------------------------------------------------------------------------

describe('buildEvidenceMap', () => {
  it('builds a lookup map from evidence items', () => {
    const map = buildEvidenceMap([makeEvidence('chk-1'), makeEvidence('chk-2')]);

    expect(map.size).toBe(2);
    expect(map.get('chk-1')!.chunkId).toBe('chk-1');
    expect(map.get('chk-2')!.chunkId).toBe('chk-2');
  });

  it('returns empty map for empty input', () => {
    const map = buildEvidenceMap([]);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// StreamingCitationParser
// ---------------------------------------------------------------------------

describe('StreamingCitationParser', () => {
  const evidenceMap = buildEvidenceMap([makeEvidence('chk-abc'), makeEvidence('chk-def')]);

  it('detects a complete marker in a single delta', () => {
    const parser = new StreamingCitationParser(evidenceMap);
    const results = parser.feed('Some text [cite:chk-abc]');

    expect(results).toHaveLength(1);
    expect(results[0]!.chunkId).toBe('chk-abc');
    expect(results[0]!.documentVersionId).toBe('dv-chk-abc');
  });

  it('detects markers across multiple deltas', () => {
    const parser = new StreamingCitationParser(evidenceMap);

    const r1 = parser.feed('Some text [ci');
    expect(r1).toHaveLength(0);

    const r2 = parser.feed('te:chk-def] more');
    expect(r2).toHaveLength(1);
    expect(r2[0]!.chunkId).toBe('chk-def');
  });

  it('ignores markers for chunks not in evidence set', () => {
    const parser = new StreamingCitationParser(evidenceMap);
    const results = parser.feed('[cite:chk-xyz]');

    expect(results).toHaveLength(0);
  });

  it('returns no results when no markers present', () => {
    const parser = new StreamingCitationParser(evidenceMap);
    const results = parser.feed('Plain text with no markers.');

    expect(results).toHaveLength(0);
  });

  it('flush returns remaining unmarked text', () => {
    const parser = new StreamingCitationParser(evidenceMap);
    parser.feed('Text');
    const { remainingText } = parser.flush();

    expect(remainingText).toBe('Text');
  });

  it('handles empty delta gracefully', () => {
    const parser = new StreamingCitationParser(evidenceMap);
    const results = parser.feed('');
    expect(results).toHaveLength(0);
  });
});
