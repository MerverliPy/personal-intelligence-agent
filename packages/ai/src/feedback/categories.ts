// ---------------------------------------------------------------------------
// Feedback categories (P3-T08 / FR-FBK-001)
// ---------------------------------------------------------------------------
// Re-exports the 8 feedback categories from the shared contract type and
// provides a frozen array form for runtime iteration and validation.
// ---------------------------------------------------------------------------

import type { FeedbackCategory } from '@pia/contracts';

/** All feedback categories accepted by the API and persistence layers. */
export const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = Object.freeze([
  'POSITIVE',
  'NEGATIVE',
  'INCORRECT',
  'INCOMPLETE',
  'CITATION_ISSUE',
  'STYLE_ISSUE',
  'UNSAFE',
  'FREE_TEXT',
]);

/** Type-guard for runtime validation of user input. */
export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export type { FeedbackCategory };
