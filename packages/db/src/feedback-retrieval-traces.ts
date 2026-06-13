// ---------------------------------------------------------------------------
// Feedback retrieval-trace link repository
// ---------------------------------------------------------------------------
// Per P3-T08 (FR-FBK-002 + G-004): feedback MUST be linkable to the
// retrieval traces that contributed to the model's answer. This file
// owns the `feedback_retrieval_traces` join table introduced in
// migration 010.
// ---------------------------------------------------------------------------

import type { Pool, PoolClient } from 'pg';

/**
 * Maximum number of retrieval trace links per feedback row.
 * Defensive cap to prevent abuse; application-layer enforced.
 */
export const MAX_FEEDBACK_RETRIEVAL_TRACES = 64;

/**
 * A single (feedback, retrieval_trace) link row.
 */
export interface FeedbackRetrievalTraceRow {
  feedbackId: string;
  retrievalTraceId: string;
  workspaceId: string;
  createdAt: string;
}

/**
 * Inserts links between a feedback row and one or more retrieval traces.
 *
 * Workspace scoping is enforced via the `workspace_id` column on every
 * inserted row; RLS provides defense-in-depth.
 *
 * @param executor A `Pool` or a `PoolClient` (for transactional use).
 * @param workspaceId The workspace that owns the feedback row.
 * @param feedbackId The feedback row ID.
 * @param retrievalTraceIds Deduplicated retrieval trace IDs.
 * @returns The number of rows inserted (excluding duplicates).
 */
export async function addFeedbackRetrievalTraces(
  executor: Pool | PoolClient,
  workspaceId: string,
  feedbackId: string,
  retrievalTraceIds: string[],
): Promise<number> {
  if (retrievalTraceIds.length === 0) return 0;
  const unique = Array.from(new Set(retrievalTraceIds));
  if (unique.length > MAX_FEEDBACK_RETRIEVAL_TRACES) {
    throw new Error(
      `Too many retrieval trace links (${unique.length}); max is ${MAX_FEEDBACK_RETRIEVAL_TRACES}.`,
    );
  }
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;
  for (const traceId of unique) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
    values.push(feedbackId, traceId, workspaceId);
  }
  const result = await executor.query(
    `INSERT INTO feedback_retrieval_traces
       (feedback_id, retrieval_trace_id, workspace_id)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (feedback_id, retrieval_trace_id) DO NOTHING`,
    values,
  );
  return result.rowCount ?? 0;
}

/**
 * Lists retrieval trace IDs linked to a feedback row, scoped to the
 * given workspace. Returns an empty array when the feedback does not
 * exist or belongs to a different workspace.
 */
export async function getFeedbackRetrievalTraces(
  pool: Pool,
  workspaceId: string,
  feedbackId: string,
): Promise<string[]> {
  const result = await pool.query<{ retrieval_trace_id: string }>(
    `SELECT retrieval_trace_id
     FROM feedback_retrieval_traces
     WHERE workspace_id = $1 AND feedback_id = $2
     ORDER BY created_at ASC`,
    [workspaceId, feedbackId],
  );
  return result.rows.map((r) => r.retrieval_trace_id);
}

/**
 * Removes all retrieval-trace links for a feedback row.
 * Used when a feedback row is deleted (FK cascade also handles this
 * at the DB level; this function exists for explicit cleanup).
 */
export async function deleteFeedbackRetrievalTraces(
  pool: Pool,
  workspaceId: string,
  feedbackId: string,
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM feedback_retrieval_traces
     WHERE workspace_id = $1 AND feedback_id = $2`,
    [workspaceId, feedbackId],
  );
  return result.rowCount ?? 0;
}
