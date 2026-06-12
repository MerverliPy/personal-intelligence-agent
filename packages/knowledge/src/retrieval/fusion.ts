// ---------------------------------------------------------------------------
// Fusion and deduplication — reciprocal-rank fusion (P2-T07)
// ---------------------------------------------------------------------------
// Per docs/02_ARCHITECTURE.md#8-retrieval-architecture:
//   - Normalize lexical and vector ranks
//   - Fuse through reciprocal-rank fusion or validated weighted score
//   - Remove duplicate/overlapping chunks
//   - Enforce source diversity where appropriate
// ---------------------------------------------------------------------------

import type { RetrievalCandidate } from './types.js';

/**
 * Fuses lexical and vector candidate lists using reciprocal-rank fusion (RRF).
 *
 * RRF is a rank-based method that is deterministic, parameter-free (beyond `k`),
 * and does not require score calibration between heterogeneous retrieval systems.
 *
 * Formula: RRF(d) = Σ 1/(k + rank_i(d))
 * where `rank_i(d)` is the rank of document `d` in result set `i` (1-indexed),
 * and `k` is a constant (default 60) that controls the influence of lower ranks.
 *
 * @param lexicalCandidates - Lexical candidates ordered by descending relevance.
 * @param vectorCandidates  - Vector candidates ordered by descending similarity.
 * @param k                 - RRF constant (default 60).
 * @returns Fused candidates sorted by descending RRF score.
 */
export function reciprocalRankFusion(
  lexicalCandidates: readonly RetrievalCandidate[],
  vectorCandidates: readonly RetrievalCandidate[],
  k: number = 60,
): RetrievalCandidate[] {
  // Build a map from chunkId to candidate and its RRF score
  const fused = new Map<string, { candidate: RetrievalCandidate; rrfScore: number }>();

  // Process lexical results
  for (let i = 0; i < lexicalCandidates.length; i++) {
    const candidate = lexicalCandidates[i]!;
    const rank = i + 1; // 1-indexed
    const contribution = 1 / (k + rank);

    const existing = fused.get(candidate.chunkId);
    if (existing) {
      existing.rrfScore += contribution;
      // If the candidate carries a lexical score, keep it; otherwise use the one
      // from this list
      if (existing.candidate.lexicalScore === null && candidate.lexicalScore !== null) {
        existing.candidate = candidate;
      }
    } else {
      fused.set(candidate.chunkId, {
        candidate: { ...candidate, lexicalScore: null, vectorScore: null },
        rrfScore: contribution,
      });
    }
  }

  // Store original lexical scores on the fused candidate
  for (const candidate of lexicalCandidates) {
    const entry = fused.get(candidate.chunkId);
    if (entry && candidate.lexicalScore !== null) {
      entry.candidate = { ...entry.candidate, lexicalScore: candidate.lexicalScore };
    }
  }

  // Process vector results
  for (let i = 0; i < vectorCandidates.length; i++) {
    const candidate = vectorCandidates[i]!;
    const rank = i + 1;
    const contribution = 1 / (k + rank);

    const existing = fused.get(candidate.chunkId);
    if (existing) {
      existing.rrfScore += contribution;
      if (existing.candidate.vectorScore === null && candidate.vectorScore !== null) {
        existing.candidate = { ...existing.candidate, vectorScore: candidate.vectorScore };
      }
    } else {
      fused.set(candidate.chunkId, {
        candidate: { ...candidate, lexicalScore: null, vectorScore: null },
        rrfScore: contribution,
      });
    }
  }

  // Store original vector scores
  for (const candidate of vectorCandidates) {
    const entry = fused.get(candidate.chunkId);
    if (entry && candidate.vectorScore !== null) {
      entry.candidate = { ...entry.candidate, vectorScore: candidate.vectorScore };
    }
  }

  const entries = Array.from(fused.values());
  if (entries.length === 0) return [];

  // Sort by descending RRF score, then by chunkId for deterministic ordering
  entries.sort((a, b) => {
    if (b.rrfScore !== a.rrfScore) return b.rrfScore - a.rrfScore;
    return a.candidate.chunkId.localeCompare(b.candidate.chunkId);
  });

  return entries.map((entry) => ({
    ...entry.candidate,
    lexicalScore: entry.candidate.lexicalScore,
    vectorScore: entry.candidate.vectorScore,
    // Attach the normalized RRF score as a temporary __rrfScore field
    // (will be used by the caller to set fusedScore)
  }));
}

/**
 * Deduplicates candidates by content hash, keeping only the highest-RRF-scored
 * instance for each unique content hash.
 *
 * This prevents near-duplicate chunks from different document versions
 * (or overlapping chunks within the same version) from dominating results.
 *
 * @param candidates - Fused candidates sorted by descending score.
 * @returns Deduplicated candidates preserving the original relative order.
 */
export function deduplicateByContentHash(
  candidates: readonly RetrievalCandidate[],
): RetrievalCandidate[] {
  const seen = new Set<string>();
  const deduped: RetrievalCandidate[] = [];

  for (const candidate of candidates) {
    if (!seen.has(candidate.contentHash)) {
      seen.add(candidate.contentHash);
      deduped.push(candidate);
    }
  }

  return deduped;
}

/**
 * Computes the normalized RRF score for a set of candidates.
 *
 * Returns the same candidates with the `__rrfScore` applied and an augmented
 * fusedScore. Since RRF scores are already normalized via division by maxScore,
 * the fusedScore is the RRF contribution relative to the maximum possible
 * (both lists contributing at rank 1).
 *
 * @param lexicalCandidates - Lexical candidates for max-score calculation.
 * @param vectorCandidates  - Vector candidates for max-score calculation.
 * @param k                 - RRF constant.
 * @returns Map from chunkId to normalized RRF score (0–1).
 */
export function computeRrfScores(
  lexicalCandidates: readonly RetrievalCandidate[],
  vectorCandidates: readonly RetrievalCandidate[],
  k: number = 60,
): Map<string, number> {
  const scores = new Map<string, number>();

  // Max possible RRF score: 1/(k+1) + 1/(k+1) = 2/(k+1)
  const maxPossible = 2 / (k + 1);

  for (let i = 0; i < lexicalCandidates.length; i++) {
    const candidate = lexicalCandidates[i]!;
    const contribution = 1 / (k + i + 1);
    const current = scores.get(candidate.chunkId) ?? 0;
    const normalized = maxPossible > 0 ? contribution / maxPossible : 0;
    scores.set(candidate.chunkId, Math.max(current, normalized));
  }

  for (let i = 0; i < vectorCandidates.length; i++) {
    const candidate = vectorCandidates[i]!;
    const contribution = 1 / (k + i + 1);
    const current = scores.get(candidate.chunkId) ?? 0;
    const normalized = maxPossible > 0 ? contribution / maxPossible : 0;
    scores.set(candidate.chunkId, Math.max(current, current + normalized));
  }

  return scores;
}
