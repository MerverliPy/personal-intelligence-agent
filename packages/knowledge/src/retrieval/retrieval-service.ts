// ---------------------------------------------------------------------------
// Safety limits
// ---------------------------------------------------------------------------

/** Maximum number of fused results that may be returned. */
const MAX_RESULTS = 100;

// ---------------------------------------------------------------------------
// Retrieval service configuration
// ---------------------------------------------------------------------------
// Combines lexical and vector search, fuses results with RRF, deduplicates,
// persists retrieval traces, and returns the complete result set.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { RetrievalQuery, RetrievalResponse, RetrievalResult } from './types.js';
import type { EmbeddingProvider, EmbeddingModelConfig } from '../embeddings/types.js';
import { executeLexicalSearch } from './lexical-search.js';
import { executeVectorSearch } from './vector-search.js';
import { reciprocalRankFusion, deduplicateByContentHash } from './fusion.js';

/**
 * Configuration for the retrieval service.
 */
export interface RetrievalServiceConfig {
  /** Database pool for queries and trace persistence. */
  readonly pool: Pool;

  /** Embedding provider for query vector generation. */
  readonly embeddingProvider: EmbeddingProvider;

  /** Model configuration for embedding. */
  readonly embeddingModelConfig: EmbeddingModelConfig;

  /** RRF constant `k` (default 60). */
  readonly rrfK?: number;

  /** Retrieval configuration name (persisted in traces). */
  readonly configName?: string;

  /** Retrieval configuration version (persisted in traces). */
  readonly configVersion?: string;
}

/**
 * Core retrieval service implementing authorized hybrid retrieval.
 */
export class RetrievalService {
  private readonly pool: Pool;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly embeddingModelConfig: EmbeddingModelConfig;
  private readonly rrfK: number;
  private readonly configName: string;
  private readonly configVersion: string;
  private readonly configIds = new Map<string, string>();

  constructor(config: RetrievalServiceConfig) {
    this.pool = config.pool;
    this.embeddingProvider = config.embeddingProvider;
    this.embeddingModelConfig = config.embeddingModelConfig;
    this.rrfK = config.rrfK ?? 60;
    this.configName = config.configName ?? 'default-hybrid';
    this.configVersion = config.configVersion ?? '1.0.0';
  }

  /**
   * Executes an authorized hybrid retrieval.
   */
  async retrieve(query: RetrievalQuery, requestedBy: string): Promise<RetrievalResponse> {
    const startTime = Date.now();

    // Validate scoreThreshold range
    const threshold = query.scoreThreshold ?? 0;
    if (threshold < 0 || threshold > 1) {
      throw new Error(`scoreThreshold must be in [0, 1], got ${threshold}`);
    }

    // Clamp maxResults
    const maxResults = Math.min(query.maxResults ?? 10, MAX_RESULTS);

    await this.ensureConfig(query.workspaceId);

    // 1. Execute lexical and vector searches in parallel
    const lexicalCandidates = await executeLexicalSearch(this.pool, query);
    const vectorCandidates = await executeVectorSearch(this.pool, query, {
      provider: this.embeddingProvider,
      modelConfig: this.embeddingModelConfig,
    });

    // 2. Fuse via reciprocal-rank fusion
    const fused = reciprocalRankFusion(lexicalCandidates, vectorCandidates, this.rrfK);

    // 3. Deduplicate by content hash
    const deduped = deduplicateByContentHash(fused);

    // 4. Compute normalized RRF scores for each candidate
    const rrfScoreMap = computeNormalizedRrfScores(lexicalCandidates, vectorCandidates, this.rrfK);

    // 5. Apply maxResults and score threshold, build final results
    const finalResults: RetrievalResult[] = [];
    for (const candidate of deduped) {
      if (finalResults.length >= maxResults) break;

      const fusedScore = rrfScoreMap.get(candidate.chunkId) ?? 0;
      if (fusedScore < threshold) continue;

      finalResults.push({
        workspaceId: candidate.workspaceId,
        projectId: candidate.projectId,
        sourceId: candidate.sourceId,
        documentId: candidate.documentId,
        documentVersionId: candidate.documentVersionId,
        chunkId: candidate.chunkId,
        locator: candidate.locator,
        text: candidate.content,
        lexicalScore: candidate.lexicalScore,
        vectorScore: candidate.vectorScore,
        fusedScore,
        retrievalConfigVersion: this.configVersion,
        retrievalTraceId: '', // filled after trace persistence
        contentHash: candidate.contentHash,
      });
    }

    // 6. Persist retrieval trace (after measuring latency)
    const latencyMs = Date.now() - startTime;
    const trace = await this.persistTrace(
      query,
      requestedBy,
      finalResults,
      lexicalCandidates.length,
      vectorCandidates.length,
      fused.length,
      latencyMs,
    );

    // Attach trace ID to results
    const resultsWithTrace = finalResults.map((r) => ({
      ...r,
      retrievalTraceId: trace.id,
    }));

    return {
      results: resultsWithTrace,
      traceId: trace.id,
      lexicalCandidateCount: lexicalCandidates.length,
      vectorCandidateCount: vectorCandidates.length,
      fusedCount: fused.length,
      latencyMs,
    };
  }

  /**
   * Ensures the retrieval configuration is persisted per-workspace (idempotent).
   */
  private async ensureConfig(workspaceId: string): Promise<void> {
    const cached = this.configIds.get(workspaceId);
    if (cached) return;

    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO retrieval_configs (workspace_id, name, version, configuration, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (workspace_id, name, version) DO UPDATE SET configuration = $4
       RETURNING id`,
      [
        workspaceId,
        this.configName,
        this.configVersion,
        JSON.stringify({
          rrfK: this.rrfK,
          embeddingModel: this.embeddingModelConfig.model,
          embeddingVersion: this.embeddingModelConfig.version,
        }),
      ],
    );

    this.configIds.set(workspaceId, result.rows[0]!.id);
  }

  /**
   * Persists a retrieval trace and associated result rows.
   */
  private async persistTrace(
    query: RetrievalQuery,
    requestedBy: string,
    results: readonly RetrievalResult[],
    _lexicalCount: number,
    _vectorCount: number,
    _fusedCount: number,
    latencyMs: number,
  ): Promise<{ id: string }> {
    const configId = this.configIds.get(query.workspaceId);
    if (!configId) {
      throw new Error('Retrieval config not persisted before trace creation');
    }

    const traceResult = await this.pool.query<{ id: string }>(
      `INSERT INTO retrieval_traces
         (workspace_id, project_id, requested_by, query_text, filters,
          retrieval_config_id, result_count, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        query.workspaceId,
        query.projectId ?? null,
        requestedBy,
        query.queryText,
        JSON.stringify({
          workspaceId: query.workspaceId,
          projectId: query.projectId,
          sensitivity: query.sensitivity,
          sourceId: query.sourceId,
          maxResults: query.maxResults,
          lexicalCandidateLimit: query.lexicalCandidateLimit,
          vectorCandidateLimit: query.vectorCandidateLimit,
          includeHistorical: query.includeHistorical,
        }),
        configId,
        results.length,
        latencyMs,
      ],
    );

    const traceId = traceResult.rows[0]!.id;

    // Persist individual result rows
    if (results.length > 0) {
      const valueRows: string[] = [];
      const allParams: unknown[] = [];
      let idx = 1;

      for (let i = 0; i < results.length; i++) {
        const rank = i + 1;
        const r = results[i]!;
        valueRows.push(
          `($${idx}::uuid, $${idx + 1}::int, $${idx + 2}::uuid, $${idx + 3}::double precision, $${idx + 4}::double precision, $${idx + 5}::double precision)`,
        );
        allParams.push(traceId, rank, r.chunkId, r.lexicalScore, r.vectorScore, r.fusedScore);
        idx += 6;
      }

      await this.pool.query(
        `INSERT INTO retrieval_results (retrieval_trace_id, rank, chunk_id, lexical_score, vector_score, fused_score)
         VALUES ${valueRows.join(', ')}`,
        allParams,
      );
    }

    return { id: traceId };
  }
}

// ---------------------------------------------------------------------------
// Normalized RRF score computation
// ---------------------------------------------------------------------------

/**
 * Computes normalized RRF scores in [0, 1] for all candidates that appear
 * in either the lexical or vector result lists.
 *
 * Normalization is relative to the maximum possible RRF score
 * (a chunk appearing at rank 1 in both lists).
 */
function computeNormalizedRrfScores(
  lexicalCandidates: readonly { chunkId: string }[],
  vectorCandidates: readonly { chunkId: string }[],
  k: number = 60,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (let i = 0; i < lexicalCandidates.length; i++) {
    const chunkId = lexicalCandidates[i]!.chunkId;
    const contribution = 1 / (k + i + 1);
    scores.set(chunkId, (scores.get(chunkId) ?? 0) + contribution);
  }

  for (let i = 0; i < vectorCandidates.length; i++) {
    const chunkId = vectorCandidates[i]!.chunkId;
    const contribution = 1 / (k + i + 1);
    scores.set(chunkId, (scores.get(chunkId) ?? 0) + contribution);
  }

  // Max possible RRF score: chunk at rank 1 in both lists
  const maxPossible = 2 / (k + 1);
  if (maxPossible <= 0) return scores;

  for (const [chunkId, score] of scores) {
    scores.set(chunkId, score / maxPossible);
  }

  return scores;
}
