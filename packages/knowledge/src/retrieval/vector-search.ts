// ---------------------------------------------------------------------------
// Vector search — pgvector nearest-neighbor query (P2-T07)
// ---------------------------------------------------------------------------
// Uses pgvector `<=>` cosine distance operator against chunk_embeddings,
// joined with document_chunks for lifecycle and authorization filtering.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { RetrievalQuery, RetrievalCandidate } from './types.js';
import type { EmbeddingProvider, EmbeddingModelConfig } from '../embeddings/types.js';

/**
 * Raw row shape returned by the vector search query.
 */
interface VectorRow {
  chunk_id: string;
  workspace_id: string;
  project_id: string | null;
  source_id: string | null;
  document_id: string;
  document_version_id: string;
  locator: Record<string, unknown>;
  content: string;
  content_hash: string;
  distance: number;
}

/**
 * Options for vector search execution.
 */
export interface VectorSearchOptions {
  /** Embedding provider to generate the query vector. */
  readonly provider: EmbeddingProvider;

  /** Model configuration for query embedding. */
  readonly modelConfig: EmbeddingModelConfig;
}

/**
 * Converts a cosine distance (0=identical, 2=opposite) to a similarity
 * score in [0, 1] where 1 = most similar.
 */
function cosineDistanceToSimilarity(distance: number): number {
  // Cosine distance range: [0, 2]
  // Similarity = 1 - (distance / 2)
  // Maps: distance=0 → 1.0 (identical), distance=1 → 0.5 (orthogonal), distance=2 → 0.0 (opposite)
  return Math.max(0, Math.min(1, 1 - distance / 2));
}

/**
 * Executes a vector (semantic) search against the chunk_embeddings table.
 *
 * Generates a query embedding using the provided provider, then performs
 * a pgvector nearest-neighbor search filtered by:
 *   - Workspace scope (mandatory)
 *   - Project scope (optional)
 *   - Lifecycle filters: READY, is_current, not deleted, not quarantined
 *   - Embedding model/version consistency
 *   - Sensitivity filter (optional)
 *   - Source filter (optional)
 *
 * Returns candidates ordered by ascending cosine distance (most similar first).
 */
export async function executeVectorSearch(
  pool: Pool,
  query: RetrievalQuery,
  options: VectorSearchOptions,
): Promise<RetrievalCandidate[]> {
  const limit = query.vectorCandidateLimit ?? 20;

  // 1. Generate embedding for the query text
  const embedResponse = await options.provider.embed({
    model: options.modelConfig,
    inputs: [{ index: 0, text: query.queryText }],
  });

  const queryVector = embedResponse.results[0]?.vector;
  if (!queryVector || queryVector.length === 0) {
    throw new Error('Embedding provider returned an empty vector for the query');
  }

  // 2. Build the SQL query
  const conditions: string[] = [
    `dv.workspace_id = $2`,
    `dv.status = 'READY'`,
    `dv.deleted_at IS NULL`,
    `d.deleted_at IS NULL`,
    `ce.embedding_model = $3`,
    `ce.embedding_version = $4`,
  ];

  const params: unknown[] = [
    `[${queryVector.join(',')}]`, // pgvector array literal
    query.workspaceId,
    options.modelConfig.model,
    options.modelConfig.version,
  ];
  let paramIdx = 5;

  if (query.projectId) {
    conditions.push(`dc.project_id = $${paramIdx}`);
    params.push(query.projectId);
    paramIdx++;
  }

  if (query.sensitivity) {
    conditions.push(`d.sensitivity = $${paramIdx}`);
    params.push(query.sensitivity);
    paramIdx++;
  }

  if (query.sourceId) {
    conditions.push(`dc.source_id = $${paramIdx}`);
    params.push(query.sourceId);
    paramIdx++;
  }

  if (query.allowedDocumentIds && query.allowedDocumentIds.length > 0) {
    const placeholders = query.allowedDocumentIds.map(() => `$${paramIdx++}`);
    conditions.push(`dc.document_id IN (${placeholders.join(', ')})`);
    params.push(...query.allowedDocumentIds);
  }

  if (query.allowedProjectIds && query.allowedProjectIds.length > 0) {
    const placeholders = query.allowedProjectIds.map(() => `$${paramIdx++}`);
    conditions.push(`(dc.project_id IS NULL OR dc.project_id IN (${placeholders.join(', ')}))`);
    params.push(...query.allowedProjectIds);
  }

  if (!query.includeHistorical) {
    conditions.push(`dv.is_current = true`);
  }

  const sql = `
    SELECT
      dc.id AS chunk_id,
      dc.workspace_id,
      dc.project_id,
      dc.source_id,
      dc.document_id,
      dc.document_version_id,
      dc.locator,
      dc.content,
      dc.content_hash,
      (ce.embedding <=> $1)::double precision AS distance
    FROM chunk_embeddings ce
    INNER JOIN document_chunks dc ON dc.id = ce.chunk_id
    INNER JOIN document_versions dv ON dv.id = dc.document_version_id
    INNER JOIN documents d ON d.id = dc.document_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ce.embedding <=> $1
    LIMIT $${paramIdx}
  `;

  params.push(limit);

  const result = await pool.query<VectorRow>(sql, params);

  // 3. Map to RetrievalCandidate with cosine distance → similarity conversion
  return result.rows.map((row) => ({
    chunkId: row.chunk_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceId: row.source_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    locator: row.locator,
    content: row.content,
    contentHash: row.content_hash,
    lexicalScore: null,
    vectorScore: cosineDistanceToSimilarity(row.distance),
  }));
}
