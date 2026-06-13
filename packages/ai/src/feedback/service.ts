// ---------------------------------------------------------------------------
// Feedback service (P3-T08 / FR-FBK-001..004)
// ---------------------------------------------------------------------------
// Orchestrates feedback submission end-to-end:
//   1. Inserts the feedback row.
//   2. Links retrieval traces (if any).
//   3. Runs the deterministic classifier to produce a suggestion.
//   4. Persists the suggestion on the feedback row.
//   5. Returns the row + suggestion to the caller.
//
// SECURITY:
//   - The suggestion is STORED on the feedback row but NEVER applied to
//     any other system. No memory write, no prompt write, no run-state
//     change. This is the FR-FBK-004 guarantee.
//   - The classifier is a pure function of the feedback category.
//     Free-text content is not inspected.
//   - Workspace authorization is enforced via the `workspace_id`
//     parameter and the RLS policies on `feedback` and
//     `feedback_retrieval_traces`.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import {
  createFeedback,
  setFeedbackSuggestion,
  addFeedbackRetrievalTraces,
  getFeedback,
  type FeedbackRow,
} from '@pia/db';
import type { FailureClass } from '@pia/db';
import type { FeedbackCategory } from '@pia/contracts';
import { classify, type FeedbackSuggestion } from './classifier.js';

export interface SubmitFeedbackInput {
  workspaceId: string;
  messageId: string;
  submittedBy: string;
  category: FeedbackCategory;
  correction?: string | null;
  notes?: string | null;
  modelRunId?: string | null;
  retrievalTraceIds?: string[];
  /**
   * Client-supplied suggestion override. When present AND non-null, the
   * service stores this in lieu of the classifier output. This is
   * reserved for future LLM-driven classification (P6-T03).
   */
  suggestedFailureClass?: FailureClass | null | undefined;
  classificationConfidence?: number | null | undefined;
}

export interface SubmitFeedbackResult {
  row: FeedbackRow;
  suggestion: FeedbackSuggestion;
}

/**
 * Submits feedback, runs the classifier, and persists the suggestion.
 *
 * @param pool A `pg.Pool` used for all inserts.
 * @param input Submission parameters.
 * @returns The persisted feedback row and the classifier suggestion.
 */
export async function submitFeedback(
  pool: Pool,
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  // 1. Insert the feedback row.
  const row = await createFeedback(pool, {
    workspaceId: input.workspaceId,
    messageId: input.messageId,
    submittedBy: input.submittedBy,
    category: input.category,
    correction: input.correction ?? null,
    notes: input.notes ?? null,
    modelRunId: input.modelRunId ?? null,
    suggestedFailureClass: input.suggestedFailureClass ?? null,
    classificationConfidence: input.classificationConfidence ?? null,
  });

  // 2. Link retrieval traces (no-op when absent or empty).
  if (input.retrievalTraceIds && input.retrievalTraceIds.length > 0) {
    await addFeedbackRetrievalTraces(pool, input.workspaceId, row.id, input.retrievalTraceIds);
  }

  // 3. Run the deterministic classifier.
  // SECURITY: only the category is passed; the free-text content is
  // explicitly not passed (the classifier signature accepts but
  // ignores it).
  const suggestion = classify(input.category);

  // 4. Persist the suggestion when the client did not supply one.
  if (input.suggestedFailureClass == null && suggestion.category !== null) {
    await setFeedbackSuggestion(
      pool,
      input.workspaceId,
      row.id,
      suggestion.category,
      suggestion.confidence,
    );
  }

  // 5. Re-read the row to pick up the suggestion columns and trace IDs.
  const refreshed = await getFeedback(pool, input.workspaceId, row.id);

  return {
    row: refreshed ?? row,
    suggestion,
  };
}
