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
//     parameter, the `getMessage` workspace-alignment check below
//     (AUD-P3-101, defense-in-depth), and the RLS policies on
//     `feedback` and `feedback_retrieval_traces`.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import {
  createFeedback,
  setFeedbackSuggestion,
  addFeedbackRetrievalTraces,
  getFeedback,
  getMessage,
  type FeedbackRow,
} from '@pia/db';
import type { FailureClass } from '@pia/db';
import type { FeedbackCategory } from '@pia/contracts';
import { classify, type FeedbackSuggestion } from './classifier.js';

/**
 * Thrown when feedback is submitted for a `messageId` that does not
 * exist in the supplied workspace (AUD-P3-101).
 *
 * The FK on `feedback.message_id` checks existence only — it does
 * not enforce workspace alignment. Without the explicit check in
 * `submitFeedback`, a direct caller (bypassing the API route) could
 * insert a feedback row whose `workspace_id` is the caller's but
 * whose `message_id` belongs to a different workspace.
 *
 * This is defense-in-depth on top of the route-layer
 * `requireWorkspaceContext` check at `apps/api/src/routes/feedback.ts`.
 */
export class MessageNotFoundError extends Error {
  readonly messageId: string;
  readonly workspaceId: string;
  constructor(messageId: string, workspaceId: string) {
    super(`Message ${messageId} not found in workspace ${workspaceId}.`);
    this.name = 'MessageNotFoundError';
    this.messageId = messageId;
    this.workspaceId = workspaceId;
  }
}

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
  // AUD-P3-101 (P4 pre-flight): verify that the message belongs to
  // the supplied workspace before inserting feedback. The FK on
  // feedback.message_id checks existence only — it does not enforce
  // workspace_id alignment. Without this check, a caller that
  // bypasses the route layer could insert feedback for a message in
  // a different workspace (the row would land in the caller's
  // workspace but reference a foreign message). This is
  // defense-in-depth on top of the route-layer `requireWorkspaceContext`.
  const message = await getMessage(pool, input.workspaceId, input.messageId);
  if (message === null) {
    throw new MessageNotFoundError(input.messageId, input.workspaceId);
  }

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
