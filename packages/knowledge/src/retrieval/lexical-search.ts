// ---------------------------------------------------------------------------
// Lexical search — PostgreSQL full-text query (P2-T07)
// ---------------------------------------------------------------------------
// Uses PostgreSQL tsquery/ts_rank against document_chunks.search_vector
// with lifecycle and authorization filters applied in SQL.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { RetrievalQuery, RetrievalCandidate } from './types.js';

/**
 * Raw row shape returned by the lexical search query.
 */
interface LexicalRow {
  chunk_id: string;
  workspace_id: string;
  project_id: string | null;
  source_id: string | null;
  document_id: string;
  document_version_id: string;
  locator: Record<string, unknown>;
  content: string;
  content_hash: string;
  lexical_score: number;
}

/**
 * Builds a PostgreSQL `tsquery` string from a natural-language query.
 *
 * Converts the query to a simple phrase-based tsquery using `plainto_tsquery`
 * which treats the input as natural language and produces `&` (AND) connections.
 *
 * The caller uses parameterized queries, so this string is safe to embed.
 */
function buildTsQuery(): string {
  // Use plainto_tsquery which handles natural language input and
  // automatically connects tokens with & (AND).
  return `plainto_tsquery('english', $1)`;
}

/**
 * Executes a lexical (full-text) search against the document_chunks table.
 *
 * Applies:
 *   - Workspace scope (mandatory)
 *   - Project scope (optional)
 *   - Lifecycle filters: READY, is_current, not deleted, not quarantined
 *   - Sensitivity filter (optional)
 *   - Source filter (optional)
 *   - Historical exclusion (default — only current versions)
 *
 * Returns candidates ordered by descending `ts_rank` normalized to [0, 1].
 */
export async function executeLexicalSearch(
  pool: Pool,
  query: RetrievalQuery,
): Promise<RetrievalCandidate[]> {
  const limit = query.lexicalCandidateLimit ?? 20;
  const tsQueryFn = buildTsQuery();

  const conditions: string[] = [
    `dv.workspace_id = $2`,
    `dv.status = 'READY'`,
    `dv.deleted_at IS NULL`,
    `d.deleted_at IS NULL`,
  ];

  const params: unknown[] = [query.queryText, query.workspaceId];
  let paramIdx = 3;

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
      ts_rank(dc.search_vector, ${tsQueryFn})::double precision AS lexical_score
    FROM document_chunks dc
    INNER JOIN document_versions dv ON dv.id = dc.document_version_id
    INNER JOIN documents d ON d.id = dc.document_id
    WHERE ${conditions.join(' AND ')}
      AND dc.search_vector @@ ${tsQueryFn}
    ORDER BY lexical_score DESC
    LIMIT $${paramIdx}
  `;

  params.push(limit);

  const result = await pool.query<LexicalRow>(sql, params);

  // Normalize scores to [0, 1]
  const rows = result.rows;
  if (rows.length === 0) return [];

  const maxScore = Math.max(...rows.map((r) => r.lexical_score));

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceId: row.source_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    locator: row.locator,
    content: row.content,
    contentHash: row.content_hash,
    lexicalScore: maxScore > 0 ? row.lexical_score / maxScore : 0,
    vectorScore: null,
  }));
}
