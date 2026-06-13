// ---------------------------------------------------------------------------
// Feedback domain types and repository
// ---------------------------------------------------------------------------
// Per P3-T08: feedback captures user sentiment and corrections linked to
// exact messages and model runs. Automatic failure classification is stored
// as a suggestion with confidence; it does not automatically change behaviour.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { FailureClass } from '@pia/domain';

export type FeedbackCategory =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'INCORRECT'
  | 'INCOMPLETE'
  | 'CITATION_ISSUE'
  | 'STYLE_ISSUE'
  | 'UNSAFE'
  | 'FREE_TEXT';

export interface FeedbackRow {
  id: string;
  workspaceId: string;
  messageId: string;
  modelRunId: string | null;
  submittedBy: string;
  category: FeedbackCategory;
  correction: string | null;
  notes: string | null;
  suggestedFailureClass: string | null;
  classificationConfidence: number | null;
  /** Retrieval trace IDs linked to this feedback (populated on read). */
  retrievalTraceIds: string[];
  createdAt: string;
}

export interface CreateFeedbackInput {
  workspaceId: string;
  messageId: string;
  modelRunId?: string | null;
  submittedBy: string;
  category: FeedbackCategory;
  correction?: string | null;
  notes?: string | null;
  suggestedFailureClass?: FailureClass | null;
  classificationConfidence?: number | null;
}

export async function createFeedback(pool: Pool, input: CreateFeedbackInput): Promise<FeedbackRow> {
  const result = await pool.query<DbFeedback>(
    `INSERT INTO feedback
       (workspace_id, message_id, model_run_id, submitted_by, category,
        correction, notes, suggested_failure_class, classification_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.workspaceId,
      input.messageId,
      input.modelRunId ?? null,
      input.submittedBy,
      input.category,
      input.correction ?? null,
      input.notes ?? null,
      input.suggestedFailureClass ?? null,
      input.classificationConfidence ?? null,
    ],
  );
  const row = toFeedbackRow(result.rows[0]!);
  row.retrievalTraceIds = [];
  return row;
}

export async function getFeedbackForMessage(
  pool: Pool,
  workspaceId: string,
  messageId: string,
): Promise<FeedbackRow[]> {
  const result = await pool.query<DbFeedback>(
    `SELECT *
     FROM feedback
     WHERE workspace_id = $1 AND message_id = $2
     ORDER BY created_at DESC`,
    [workspaceId, messageId],
  );
  const rows = result.rows.map(toFeedbackRow);
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  await hydrateRetrievalTraceIds(pool, workspaceId, rows, ids);
  return rows;
}

export async function getFeedback(
  pool: Pool,
  workspaceId: string,
  feedbackId: string,
): Promise<FeedbackRow | null> {
  const result = await pool.query<DbFeedback>(
    `SELECT *
     FROM feedback
     WHERE id = $1 AND workspace_id = $2`,
    [feedbackId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  const row = toFeedbackRow(result.rows[0]!);
  await hydrateRetrievalTraceIds(pool, workspaceId, [row], [row.id]);
  return row;
}

/**
 * Updates the suggestion columns on a feedback row.
 *
 * Per FR-FBK-003: the classification is stored as a suggestion with
 * confidence. This function is the only path that writes those columns
 * after the row exists. It is a no-op when both fields are null.
 */
export async function setFeedbackSuggestion(
  pool: Pool,
  workspaceId: string,
  feedbackId: string,
  suggestedFailureClass: FailureClass | null,
  classificationConfidence: number | null,
): Promise<void> {
  if (suggestedFailureClass === null && classificationConfidence === null) return;
  await pool.query(
    `UPDATE feedback
     SET suggested_failure_class = $3,
         classification_confidence = $4
     WHERE id = $1 AND workspace_id = $2`,
    [feedbackId, workspaceId, suggestedFailureClass, classificationConfidence],
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hydrates `retrievalTraceIds` on a batch of feedback rows in a single
 * round-trip. Rows are mutated in place. No-op when the input is empty.
 */
async function hydrateRetrievalTraceIds(
  pool: Pool,
  workspaceId: string,
  rows: FeedbackRow[],
  feedbackIds: string[],
): Promise<void> {
  if (rows.length === 0) return;
  const traceResult = await pool.query<{ feedback_id: string; retrieval_trace_id: string }>(
    `SELECT feedback_id, retrieval_trace_id
     FROM feedback_retrieval_traces
     WHERE workspace_id = $1 AND feedback_id = ANY($2::uuid[])`,
    [workspaceId, feedbackIds],
  );
  const byFeedback = new Map<string, string[]>();
  for (const r of traceResult.rows) {
    const list = byFeedback.get(r.feedback_id) ?? [];
    list.push(r.retrieval_trace_id);
    byFeedback.set(r.feedback_id, list);
  }
  for (const row of rows) {
    row.retrievalTraceIds = byFeedback.get(row.id) ?? [];
  }
}

type DbFeedback = {
  id: string;
  workspace_id: string;
  message_id: string;
  model_run_id: string | null;
  submitted_by: string;
  category: FeedbackCategory;
  correction: string | null;
  notes: string | null;
  suggested_failure_class: string | null;
  classification_confidence: number | null;
  created_at: string;
};

function toFeedbackRow(row: DbFeedback): FeedbackRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    messageId: row.message_id,
    modelRunId: row.model_run_id,
    submittedBy: row.submitted_by,
    category: row.category,
    correction: row.correction,
    notes: row.notes,
    suggestedFailureClass: row.suggested_failure_class,
    classificationConfidence: row.classification_confidence,
    retrievalTraceIds: [],
    createdAt: row.created_at,
  };
}
