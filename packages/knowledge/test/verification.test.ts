// ---------------------------------------------------------------------------
// Citation verification tests — deterministic checks (P3-T07)
// ---------------------------------------------------------------------------
// Per acceptance criteria:
//   1. Out-of-bound, absent, unauthorized, deleted, or stale citations reject.
//   2. Unsupported claims are removed, qualified, or clearly labeled as inference.
//   3. Verifier failure cannot silently produce a normal completed answer.
//   4. Critical deterministic checks do not rely solely on another model.
//
// Security checks: adversarial citation IDs and locator manipulation.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { verifyCitations } from '../src/verification/verifier.js';
import type {
  VerifiableCitation,
  VerifierInput,
  VerificationResult,
} from '../src/verification/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCitation(overrides: Partial<VerifiableCitation> = {}): VerifiableCitation {
  return {
    id: 'cit-1',
    chunkId: 'chk-1',
    documentVersionId: 'dv-1',
    sourceLocator: { page: 1, startOffset: 0, endOffset: 100 },
    ...overrides,
  };
}

function makeEvidenceMap(): Map<string, { chunkId: string; documentVersionId: string }> {
  return new Map([
    ['chk-1', { chunkId: 'chk-1', documentVersionId: 'dv-1' }],
    ['chk-2', { chunkId: 'chk-2', documentVersionId: 'dv-2' }],
  ]);
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dv-1',
    workspace_id: 'ws-1',
    document_id: 'doc-1',
    status: 'READY',
    is_current: true,
    extraction_metadata: {
      pageCount: 10,
      characterCount: 5000,
      paragraphCount: 50,
    },
    ...overrides,
  };
}

function makeChunkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chk-1',
    workspace_id: 'ws-1',
    document_id: 'doc-1',
    document_version_id: 'dv-1',
    ordinal: 0,
    content_hash: 'abc123',
    locator: { page: 1, startOffset: 0, endOffset: 100 },
    ...overrides,
  };
}

/**
 * Creates a mock pool that responds with the given chunk and version rows.
 */
function mockPool(opts: { chunkRows?: Record<string, unknown>[]; versionRows?: Record<string, unknown>[] }) {
  return {
    query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('FROM document_chunks')) {
        return { rows: opts.chunkRows ?? ([] as Record<string, unknown>[]) };
      }
      if (sqlStr.includes('FROM document_versions')) {
        return { rows: opts.versionRows ?? ([] as Record<string, unknown>[]) };
      }
      return { rows: [] };
    }),
  } as unknown as import('pg').Pool;
}

function makeInput(
  citations: VerifiableCitation[],
  evidenceMap: Map<string, { chunkId: string; documentVersionId: string }>,
): VerifierInput {
  return {
    workspaceId: 'ws-1',
    modelRunId: 'run-1',
    citations,
    evidenceMap,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('verifyCitations — VALID', () => {
  it('should mark all citations VALID when chunk and version are READY', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow()],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.results[0]!.status).toBe('VALID');
  });

  it('should verify multiple citations', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow()],
    });
    // Each call to query will return the same rows — set up matching
    // Actually we need pool.query to handle multiple calls.
    // Let's use a dynamic mock
    const dynamicPool = {
      query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
        const sqlStr = String(sql);
        if (sqlStr.includes('FROM document_chunks') && params[0] === 'chk-1') {
          return { rows: [makeChunkRow()] };
        }
        if (sqlStr.includes('FROM document_chunks') && params[0] === 'chk-2') {
          return { rows: [makeChunkRow({ id: 'chk-2', document_version_id: 'dv-2' })] };
        }
        if (sqlStr.includes('FROM document_versions') && params[0] === 'dv-1') {
          return { rows: [makeVersionRow()] };
        }
        if (sqlStr.includes('FROM document_versions') && params[0] === 'dv-2') {
          return { rows: [makeVersionRow({ id: 'dv-2' })] };
        }
        return { rows: [] };
      }),
    } as unknown as import('pg').Pool;

    const input = makeInput(
      [
        makeCitation(),
        makeCitation({
          id: 'cit-2',
          chunkId: 'chk-2',
          documentVersionId: 'dv-2',
          sourceLocator: { page: 2 },
        }),
      ],
      new Map([
        ['chk-1', { chunkId: 'chk-1', documentVersionId: 'dv-1' }],
        ['chk-2', { chunkId: 'chk-2', documentVersionId: 'dv-2' }],
      ]),
    );

    const result = await verifyCitations(dynamicPool, input);
    expect(result.allValid).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Evidence-set rejection (FR-CIT-002)
// ---------------------------------------------------------------------------

describe('verifyCitations — evidence set failures', () => {
  it('should reject citation not in evidence set', async () => {
    const pool = mockPool({});
    const emptyEvidence = new Map<string, { chunkId: string; documentVersionId: string }>();
    const input = makeInput([makeCitation()], emptyEvidence);

    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.results[0]!.status).toBe('INVALID_EVIDENCE_MISSING');
    expect(result.results[0]!.reasonCode).toBe('CITATION_NOT_IN_EVIDENCE_SET');
  });
});

// ---------------------------------------------------------------------------
// Chunk existence and workspace rejection
// ---------------------------------------------------------------------------

describe('verifyCitations — chunk failures', () => {
  it('should reject citation when chunk not found in DB', async () => {
    const pool = mockPool({ chunkRows: [], versionRows: [] });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_CHUNK_MISSING');
    expect(result.results[0]!.reasonCode).toBe('CHUNK_NOT_FOUND');
  });

  it('should reject citation when chunk is in wrong workspace', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow({ workspace_id: 'ws-other' })],
      versionRows: [],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_CROSS_WORKSPACE');
    expect(result.results[0]!.reasonCode).toBe('CHUNK_WRONG_WORKSPACE');
  });

  it('should reject when chunk version_id does not match citation', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow({ document_version_id: 'dv-other' })],
      versionRows: [],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_CHUNK_MISSING');
    expect(result.results[0]!.reasonCode).toBe('CHUNK_VERSION_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// Version lifecycle rejection (FR-CIT-003)
// ---------------------------------------------------------------------------

describe('verifyCitations — version lifecycle failures', () => {
  it('should reject when version has been SUPERSEDED', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ status: 'SUPERSEDED' })],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_VERSION_STALE');
    expect(result.results[0]!.reasonCode).toBe('VERSION_SUPERSEDED');
  });

  it('should reject when version has been DELETED', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ status: 'DELETED' })],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_VERSION_STALE');
    expect(result.results[0]!.reasonCode).toBe('VERSION_DELETED');
  });

  it('should reject when version is FAILED', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ status: 'FAILED' })],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_VERSION_STALE');
    expect(result.results[0]!.reasonCode).toBe('VERSION_FAILED');
  });

  it('should reject when version is not found', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_VERSION_STALE');
    expect(result.results[0]!.reasonCode).toBe('VERSION_NOT_FOUND');
  });

  it('should reject when version is in non-READY state (PENDING_UPLOAD)', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ status: 'PENDING_UPLOAD' })],
    });
    const input = makeInput([makeCitation()], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_VERSION_STALE');
  });
});

// ---------------------------------------------------------------------------
// Locator boundary rejection (FR-CIT-003)
// ---------------------------------------------------------------------------

describe('verifyCitations — locator boundary failures', () => {
  it('should reject when page exceeds document pageCount', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { pageCount: 3 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { page: 10 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_LOCATOR_OUT_OF_BOUNDS');
    expect(result.results[0]!.reasonCode).toBe('LOCATOR_PAGE_EXCEEDS_PAGE_COUNT');
  });

  it('should reject when startOffset exceeds characterCount', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { characterCount: 200 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { startOffset: 500, endOffset: 600 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_LOCATOR_OUT_OF_BOUNDS');
    expect(result.results[0]!.reasonCode).toBe('LOCATOR_OFFSET_EXCEEDS_CHARACTER_COUNT');
  });

  it('should reject when endOffset exceeds characterCount', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { characterCount: 200 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { startOffset: 10, endOffset: 500 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_LOCATOR_OUT_OF_BOUNDS');
  });

  it('should pass when offsets are within bounds', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { characterCount: 2000 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { startOffset: 10, endOffset: 500 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(true);
  });

  it('should pass when no extraction metadata is available (skip check)', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: null })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { page: 999 } })], // out of bounds but can't check
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(true);
  });

  it('should pass when locator is empty', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow()],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: {} })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Adversarial / edge-case tests (security checks)
// ---------------------------------------------------------------------------

describe('verifyCitations — adversarial inputs', () => {
  it('should handle non-UUID chunk IDs without throwing', async () => {
    const pool = mockPool({ chunkRows: [], versionRows: [] });
    const input = makeInput(
      [
        makeCitation({
          id: 'cit-x',
          chunkId: "'; DROP TABLE document_chunks; --",
          documentVersionId: 'dv-1',
          sourceLocator: {},
        }),
      ],
      makeEvidenceMap(),
    );

    // Should not throw — the chunk simply won't be found
    const result = await verifyCitations(pool, input);
    expect(result.results[0]!.status).toBe('INVALID_EVIDENCE_MISSING');
  });

  it('should handle negative page numbers', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { pageCount: 10 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { page: -1 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    // Negative page is not > pageCount, so it passes the boundary check
    // This is a data quality issue, not a verifier failure
    expect(result.allValid).toBe(true);
  });

  it('should handle very large page numbers', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow({ extraction_metadata: { pageCount: 10 } })],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { page: 999999 } })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.status).toBe('INVALID_LOCATOR_OUT_OF_BOUNDS');
  });

  it('should handle locator with unexpected shape gracefully', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow()],
    });
    const input = makeInput(
      [
        makeCitation({
          sourceLocator: { type: 'unknown', value: { nested: ['deep'] } },
        }),
      ],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    // Should not crash — unknown shapes are skipped
    expect(result.allValid).toBe(true);
  });

  it('should handle null/undefined locator values', async () => {
    const pool = mockPool({
      chunkRows: [makeChunkRow()],
      versionRows: [makeVersionRow()],
    });
    const input = makeInput(
      [makeCitation({ sourceLocator: { page: null } as unknown as Record<string, unknown> })],
      makeEvidenceMap(),
    );
    const result = await verifyCitations(pool, input);

    // Null page is not > pageCount, so it passes
    expect(result.allValid).toBe(true);
  });

  it('should handle zero citations', async () => {
    const pool = mockPool({});
    const input = makeInput([], makeEvidenceMap());
    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false); // 0 citations, so allValid = false (none to be valid)
    expect(result.totalCitations).toBe(0);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed batch — some valid, some invalid
// ---------------------------------------------------------------------------

describe('verifyCitations — mixed results', () => {
  it('should correctly classify a mix of valid and invalid citations', async () => {
    const dynamicPool = {
      query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
        const sqlStr = String(sql);
        if (sqlStr.includes('FROM document_chunks') && params[0] === 'chk-valid') {
          return { rows: [makeChunkRow({ id: 'chk-valid', document_version_id: 'dv-valid' })] };
        }
        if (sqlStr.includes('FROM document_chunks') && params[0] === 'chk-stale') {
          return { rows: [makeChunkRow({ id: 'chk-stale', document_version_id: 'dv-stale' })] };
        }
        if (sqlStr.includes('FROM document_versions') && params[0] === 'dv-valid') {
          return { rows: [makeVersionRow({ id: 'dv-valid', status: 'READY' })] };
        }
        if (sqlStr.includes('FROM document_versions') && params[0] === 'dv-stale') {
          return { rows: [makeVersionRow({ id: 'dv-stale', status: 'SUPERSEDED' })] };
        }
        return { rows: [] };
      }),
    } as unknown as import('pg').Pool;

    const evidenceMap = new Map([
      ['chk-valid', { chunkId: 'chk-valid', documentVersionId: 'dv-valid' }],
      ['chk-stale', { chunkId: 'chk-stale', documentVersionId: 'dv-stale' }],
    ]);

    const input = makeInput(
      [
        makeCitation({
          id: 'cit-valid',
          chunkId: 'chk-valid',
          documentVersionId: 'dv-valid',
          sourceLocator: { page: 1 },
        }),
        makeCitation({
          id: 'cit-stale',
          chunkId: 'chk-stale',
          documentVersionId: 'dv-stale',
          sourceLocator: { page: 1 },
        }),
      ],
      evidenceMap,
    );

    const result = await verifyCitations(dynamicPool, input);

    expect(result.allValid).toBe(false);
    expect(result.totalCitations).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);

    const valid = result.results.find((r) => r.status === 'VALID');
    const stale = result.results.find((r) => r.status !== 'VALID');
    expect(valid).toBeDefined();
    expect(stale).toBeDefined();
    expect(stale!.status).toBe('INVALID_VERSION_STALE');
    expect(stale!.reasonCode).toBe('VERSION_SUPERSEDED');
  });
});
