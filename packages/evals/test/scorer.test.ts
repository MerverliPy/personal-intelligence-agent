// ---------------------------------------------------------------------------
// Scorer unit tests (P2-T10)
// ---------------------------------------------------------------------------
// Tests for deterministic retrieval evaluation scorers.
// No database required — these are pure unit tests.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  computeRecallAtK,
  computePrecisionAtK,
  computeMRR,
  checkVersionCorrectness,
  checkAuthorizationCorrectness,
  percentile,
  computeAggregateMetrics,
} from '../src/scorer.js';
import type { EvalCaseResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// computeRecallAtK
// ---------------------------------------------------------------------------

describe('computeRecallAtK', () => {
  it('returns 1.0 when all expected IDs are present', () => {
    const result = computeRecallAtK(['a', 'b', 'c'], ['a', 'b']);
    expect(result).toBe(1.0);
  });

  it('returns 0.5 when half of expected IDs are present', () => {
    const result = computeRecallAtK(['a', 'c'], ['a', 'b']);
    expect(result).toBe(0.5);
  });

  it('returns 0.0 when none of expected IDs are present', () => {
    const result = computeRecallAtK(['x', 'y'], ['a', 'b']);
    expect(result).toBe(0.0);
  });

  it('returns null when expected IDs list is empty', () => {
    const result = computeRecallAtK(['a', 'b'], []);
    expect(result).toBeNull();
  });

  it('handles empty retrieved list', () => {
    const result = computeRecallAtK([], ['a']);
    expect(result).toBe(0.0);
  });

  it('handles duplicate retrieved IDs correctly (set semantics)', () => {
    const result = computeRecallAtK(['a', 'a', 'a', 'b'], ['a', 'b']);
    expect(result).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// computePrecisionAtK
// ---------------------------------------------------------------------------

describe('computePrecisionAtK', () => {
  it('returns 1.0 when top-K all match expected', () => {
    const result = computePrecisionAtK(['a', 'b', 'c'], ['a', 'b', 'c'], 3);
    expect(result).toBe(1.0);
  });

  it('returns 0.5 when half of top-K match expected', () => {
    const result = computePrecisionAtK(['a', 'x', 'b', 'y'], ['a', 'b'], 4);
    expect(result).toBe(0.5);
  });

  it('returns 0.0 when none match', () => {
    const result = computePrecisionAtK(['x', 'y'], ['a', 'b'], 2);
    expect(result).toBe(0.0);
  });

  it('returns null when K is 0', () => {
    const result = computePrecisionAtK(['a'], ['a'], 0);
    expect(result).toBeNull();
  });

  it('returns null when retrieved list is empty', () => {
    const result = computePrecisionAtK([], ['a'], 5);
    expect(result).toBeNull();
  });

  it('uses minimum of K and retrieved length', () => {
    // K=5 but only 2 retrieved -> precision based on 2
    const result = computePrecisionAtK(['a', 'x'], ['a'], 5);
    expect(result).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeMRR
// ---------------------------------------------------------------------------

describe('computeMRR', () => {
  it('returns 1.0 when first result matches', () => {
    const result = computeMRR(['a', 'b', 'c'], ['a']);
    expect(result).toBe(1.0);
  });

  it('returns 0.5 when second result matches', () => {
    const result = computeMRR(['x', 'a', 'c'], ['a']);
    expect(result).toBe(0.5);
  });

  it('returns 0.0 when no expected results appear', () => {
    const result = computeMRR(['x', 'y', 'z'], ['a']);
    expect(result).toBe(0.0);
  });

  it('returns null when expected list is empty', () => {
    const result = computeMRR(['a'], []);
    expect(result).toBeNull();
  });

  it('returns first match rank even when multiple expected', () => {
    // 'a' at rank 2, 'b' at rank 1 -> MRR based on first match (rank 1)
    const result = computeMRR(['b', 'a'], ['a', 'b']);
    expect(result).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// checkVersionCorrectness
// ---------------------------------------------------------------------------

describe('checkVersionCorrectness', () => {
  it('passes when all must_include are present and must_exclude are absent', () => {
    const { passed, missing, unexpected } = checkVersionCorrectness(
      ['a', 'b', 'c'],
      ['a', 'b'],
      ['x', 'y'],
    );
    expect(passed).toBe(true);
    expect(missing).toHaveLength(0);
    expect(unexpected).toHaveLength(0);
  });

  it('fails when a must_include version is missing', () => {
    const { passed, missing, unexpected } = checkVersionCorrectness(['a', 'c'], ['a', 'b'], []);
    expect(passed).toBe(false);
    expect(missing).toContain('b');
    expect(unexpected).toHaveLength(0);
  });

  it('fails when a must_exclude version appears', () => {
    const { passed, missing, unexpected } = checkVersionCorrectness(['a', 'x'], ['a'], ['x']);
    expect(passed).toBe(false);
    expect(missing).toHaveLength(0);
    expect(unexpected).toContain('x');
  });

  it('fails on both missing and unexpected simultaneously', () => {
    const { passed, missing, unexpected } = checkVersionCorrectness(['x'], ['a'], ['x']);
    expect(passed).toBe(false);
    expect(missing).toContain('a');
    expect(unexpected).toContain('x');
  });

  it('passes with empty must_include and must_exclude', () => {
    const { passed, missing, unexpected } = checkVersionCorrectness(['a'], [], []);
    expect(passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkAuthorizationCorrectness
// ---------------------------------------------------------------------------

describe('checkAuthorizationCorrectness', () => {
  it('passes when no excluded versions appear', () => {
    const { passed, unexpected } = checkAuthorizationCorrectness(['a', 'b'], ['x', 'y']);
    expect(passed).toBe(true);
    expect(unexpected).toHaveLength(0);
  });

  it('fails when an excluded version appears', () => {
    const { passed, unexpected } = checkAuthorizationCorrectness(['a', 'x'], ['x']);
    expect(passed).toBe(false);
    expect(unexpected).toContain('x');
  });

  it('passes with empty exclude list', () => {
    const { passed } = checkAuthorizationCorrectness(['a', 'b'], []);
    expect(passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------

describe('percentile', () => {
  it('returns the only value for single-element array', () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it('calculates P50 (median) correctly', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it('calculates P50 for even-length array', () => {
    const sorted = [1, 2, 3, 4];
    // index = (50/100) * 3 = 1.5 → lower=1 (val=2), upper=2 (val=3), weight=0.5 → 2.5
    expect(percentile(sorted, 50)).toBe(2.5);
  });

  it('returns min for P0', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });

  it('returns max for P100', () => {
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });

  it('calculates P95 correctly', () => {
    const sorted = Array.from({ length: 20 }, (_, i) => i + 1);
    // P95 on [1..20]: index = 0.95 * 19 = 18.05 → lower=18 (val=19), upper=19 (val=20), weight=0.05
    const result = percentile(sorted, 95);
    expect(result).toBeCloseTo(19.05, 1);
  });

  it('returns null for empty array', () => {
    expect(percentile([], 50)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeAggregateMetrics
// ---------------------------------------------------------------------------

describe('computeAggregateMetrics', () => {
  function makeResult(overrides: Partial<EvalCaseResult> = {}): EvalCaseResult {
    return {
      caseId: 'test-001',
      passed: true,
      securityCritical: false,
      query: 'test query',
      resultCount: 5,
      latencyMs: 100,
      retrievedVersionIds: ['v1'],
      missingVersionIds: [],
      unexpectedVersionIds: [],
      recallAtK: 1.0,
      precisionAtK: 0.8,
      mrr: 0.5,
      versionCorrectnessPassed: true,
      authorizationCorrectnessPassed: true,
      latencyPassed: true,
      failures: [],
      ...overrides,
    };
  }

  it('returns zeros/null for empty results', () => {
    const metrics = computeAggregateMetrics([]);
    expect(metrics.totalCases).toBe(0);
    expect(metrics.meanRecallAtK).toBeNull();
    expect(metrics.latencyP50Ms).toBeNull();
  });

  it('counts passed and failed cases correctly', () => {
    const results = [
      makeResult({ caseId: 'c1', passed: true }),
      makeResult({ caseId: 'c2', passed: false }),
      makeResult({ caseId: 'c3', passed: true }),
    ];
    const metrics = computeAggregateMetrics(results);
    expect(metrics.totalCases).toBe(3);
    expect(metrics.passedCases).toBe(2);
    expect(metrics.failedCases).toBe(1);
  });

  it('counts security cases correctly', () => {
    const results = [
      makeResult({ caseId: 'c1', securityCritical: true, passed: true }),
      makeResult({ caseId: 'c2', securityCritical: true, passed: false }),
      makeResult({ caseId: 'c3', securityCritical: false, passed: true }),
    ];
    const metrics = computeAggregateMetrics(results);
    expect(metrics.securityCases).toBe(2);
    expect(metrics.passedSecurityCases).toBe(1);
    expect(metrics.failedSecurityCases).toBe(1);
  });

  it('computes version and authorization correctness rates', () => {
    const results = [
      makeResult({ versionCorrectnessPassed: true, authorizationCorrectnessPassed: true }),
      makeResult({ versionCorrectnessPassed: true, authorizationCorrectnessPassed: false }),
      makeResult({ versionCorrectnessPassed: false, authorizationCorrectnessPassed: true }),
      makeResult({ versionCorrectnessPassed: false, authorizationCorrectnessPassed: false }),
    ];
    const metrics = computeAggregateMetrics(results);
    expect(metrics.versionCorrectnessRate).toBe(0.5);
    expect(metrics.authorizationCorrectnessRate).toBe(0.5);
  });

  it('computes mean recall, precision, and MRR from non-null values', () => {
    const results = [
      makeResult({ recallAtK: 1.0, precisionAtK: 0.8, mrr: 1.0 }),
      makeResult({ recallAtK: 0.5, precisionAtK: null, mrr: 0.5 }),
      makeResult({ recallAtK: null, precisionAtK: 0.6, mrr: null }),
    ];
    const metrics = computeAggregateMetrics(results);
    expect(metrics.meanRecallAtK).toBeCloseTo(0.75);
    expect(metrics.meanPrecisionAtK).toBeCloseTo(0.7);
    expect(metrics.meanMRR).toBeCloseTo(0.75);
  });

  it('computes latency percentiles', () => {
    const results = [
      makeResult({ latencyMs: 100 }),
      makeResult({ latencyMs: 200 }),
      makeResult({ latencyMs: 300 }),
      makeResult({ latencyMs: 400 }),
      makeResult({ latencyMs: 500 }),
    ];
    const metrics = computeAggregateMetrics(results);
    expect(metrics.latencyP50Ms).toBe(300);
    expect(metrics.meanLatencyMs).toBe(300);
  });
});
