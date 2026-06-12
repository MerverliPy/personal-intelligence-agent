// ---------------------------------------------------------------------------
// Deterministic scorers — retrieval evaluation metrics (P2-T10)
// ---------------------------------------------------------------------------
// All scorer functions are pure and deterministic. They operate on
// already-resolved IDs (the runner resolves fixture names to DB IDs).
// Per docs/07_TEST_EVALUATION_STRATEGY.md:
//   - recall@K and precision@K
//   - MRR/nDCG
//   - version correctness
//   - authorization correctness
//   - latency (P50/P95)
// ---------------------------------------------------------------------------

import type { EvalCaseResult, EvalMetrics } from './types.js';

// ---------------------------------------------------------------------------
// Per-case scoring
// ---------------------------------------------------------------------------

/**
 * Computes recall@K: fraction of expected version IDs that appear in the
 * retrieved results.
 *
 * @param retrievedIds - Version IDs that appeared in results (first K only).
 * @param expectedIds  - Version IDs that MUST appear.
 * @returns Recall in [0, 1], or null if expectedIds is empty.
 */
export function computeRecallAtK(
  retrievedIds: readonly string[],
  expectedIds: readonly string[],
): number | null {
  if (expectedIds.length === 0) return null;
  const retrievedSet = new Set(retrievedIds);
  let found = 0;
  for (const id of expectedIds) {
    if (retrievedSet.has(id)) found++;
  }
  return found / expectedIds.length;
}

/**
 * Computes precision@K over the first K retrieved results.
 *
 * @param retrievedIds - Version IDs that appeared in results (first K).
 * @param expectedIds  - Version IDs that are considered relevant.
 * @returns Precision in [0, 1], or null if K = 0.
 */
export function computePrecisionAtK(
  retrievedIds: readonly string[],
  expectedIds: readonly string[],
  k: number,
): number | null {
  if (k <= 0 || retrievedIds.length === 0) return null;
  const topK = retrievedIds.slice(0, k);
  const expectedSet = new Set(expectedIds);
  let relevant = 0;
  for (const id of topK) {
    if (expectedSet.has(id)) relevant++;
  }
  return relevant / Math.min(k, topK.length);
}

/**
 * Computes Mean Reciprocal Rank: 1 / rank of the first expected version,
 * where rank is 1-indexed.
 *
 * @param retrievedIds - Ordered version IDs from results.
 * @param expectedIds  - Version IDs considered relevant.
 * @returns MRR in [0, 1], or null if no expected IDs or no match.
 */
export function computeMRR(
  retrievedIds: readonly string[],
  expectedIds: readonly string[],
): number | null {
  if (expectedIds.length === 0) return null;
  const expectedSet = new Set(expectedIds);
  for (let i = 0; i < retrievedIds.length; i++) {
    if (expectedSet.has(retrievedIds[i]!)) {
      return 1 / (i + 1); // 1-indexed
    }
  }
  return 0;
}

/**
 * Checks version correctness: verifies that all `must_include` versions
 * are present and all `must_exclude` versions are absent.
 */
export function checkVersionCorrectness(
  retrievedIds: readonly string[],
  mustInclude: readonly string[],
  mustExclude: readonly string[],
): { passed: boolean; missing: readonly string[]; unexpected: readonly string[] } {
  const retrievedSet = new Set(retrievedIds);

  const missing: string[] = [];
  for (const id of mustInclude) {
    if (!retrievedSet.has(id)) missing.push(id);
  }

  const unexpected: string[] = [];
  for (const id of mustExclude) {
    if (retrievedSet.has(id)) unexpected.push(id);
  }

  return {
    passed: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}

/**
 * Checks authorization correctness: verifies that no excluded versions
 * (cross-tenant, deleted, quarantined, superseded) appear in results.
 * This is the same as the exclusion half of version correctness but
 * tracked separately for aggregate reporting.
 *
 * Authorization correctness failures are always security-critical.
 */
export function checkAuthorizationCorrectness(
  retrievedIds: readonly string[],
  mustExclude: readonly string[],
): { passed: boolean; unexpected: readonly string[] } {
  const retrievedSet = new Set(retrievedIds);
  const unexpected: string[] = [];
  for (const id of mustExclude) {
    if (retrievedSet.has(id)) unexpected.push(id);
  }
  return { passed: unexpected.length === 0, unexpected };
}

// ---------------------------------------------------------------------------
// Aggregate metric computation
// ---------------------------------------------------------------------------

/**
 * Computes the P-th percentile from a sorted array of numbers.
 * Uses linear interpolation between the two closest ranks.
 */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  if (p <= 0) return sorted[0]!;
  if (p >= 100) return sorted[sorted.length - 1]!;

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  const lowerVal = sorted[lower]!;
  const upperVal = sorted[upper]!;

  return lowerVal + fraction * (upperVal - lowerVal);
}

/**
 * Computes aggregate evaluation metrics from per-case results.
 */
export function computeAggregateMetrics(caseResults: readonly EvalCaseResult[]): EvalMetrics {
  const n = caseResults.length;
  if (n === 0) {
    return {
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      securityCases: 0,
      passedSecurityCases: 0,
      failedSecurityCases: 0,
      meanRecallAtK: null,
      meanPrecisionAtK: null,
      meanMRR: null,
      versionCorrectnessRate: 0,
      authorizationCorrectnessRate: 0,
      latencyP50Ms: null,
      latencyP95Ms: null,
      meanLatencyMs: null,
    };
  }

  let passedCases = 0;
  let failedCases = 0;
  let securityCases = 0;
  let passedSecurityCases = 0;
  let failedSecurityCases = 0;
  let versionCorrectTotal = 0;
  let authorizationCorrectTotal = 0;

  const recallValues: number[] = [];
  const precisionValues: number[] = [];
  const mrrValues: number[] = [];
  const latencyValues: number[] = [];

  for (const result of caseResults) {
    if (result.passed) passedCases++;
    else failedCases++;

    if (result.securityCritical) {
      securityCases++;
      if (result.passed) passedSecurityCases++;
      else failedSecurityCases++;
    }

    if (result.versionCorrectnessPassed) versionCorrectTotal++;
    if (result.authorizationCorrectnessPassed) authorizationCorrectTotal++;

    if (result.recallAtK !== null) recallValues.push(result.recallAtK);
    if (result.precisionAtK !== null) precisionValues.push(result.precisionAtK);
    if (result.mrr !== null) mrrValues.push(result.mrr);
    latencyValues.push(result.latencyMs);
  }

  const sortedLatencies = [...latencyValues].sort((a, b) => a - b);

  return {
    totalCases: n,
    passedCases,
    failedCases,
    securityCases,
    passedSecurityCases,
    failedSecurityCases,
    meanRecallAtK: recallValues.length > 0 ? mean(recallValues) : null,
    meanPrecisionAtK: precisionValues.length > 0 ? mean(precisionValues) : null,
    meanMRR: mrrValues.length > 0 ? mean(mrrValues) : null,
    versionCorrectnessRate: n > 0 ? versionCorrectTotal / n : 0,
    authorizationCorrectnessRate: n > 0 ? authorizationCorrectTotal / n : 0,
    latencyP50Ms: percentile(sortedLatencies, 50),
    latencyP95Ms: percentile(sortedLatencies, 95),
    meanLatencyMs: latencyValues.length > 0 ? mean(latencyValues) : null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
