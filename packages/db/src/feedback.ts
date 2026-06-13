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
  | 'UNSAFE';

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
  return toFeedbackRow(result.rows[0]!);
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
  return result.rows.map(toFeedbackRow);
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
  return toFeedbackRow(result.rows[0]!);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
    createdAt: row.created_at,
  };
}
