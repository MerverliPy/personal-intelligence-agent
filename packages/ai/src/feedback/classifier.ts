// ---------------------------------------------------------------------------
// Feedback classifier (P3-T08 / FR-FBK-003)
// ---------------------------------------------------------------------------
// Deterministic, rule-based classifier that returns a failure-class
// suggestion for a given feedback category. The classifier is a thin
// wrapper around the category-to-class mapping; it exists as a
// distinct surface so that the LLM-driven classifier in P6-T03 can
// replace the implementation without changing the public signature.
// ---------------------------------------------------------------------------

import type { FeedbackCategory } from './categories.js';
import { categoryToFailureClass, type CategoryToFailureClassResult } from './failureTaxonomy.js';

/**
 * Public shape of a feedback classification suggestion.
 * Mirrors `FeedbackSuggestion` in @pia/contracts.
 */
export interface FeedbackSuggestion {
  readonly category: CategoryToFailureClassResult['category'];
  readonly confidence: number;
  readonly rationale: string;
}

/**
 * Classifies a feedback row and returns a suggestion.
 *
 * SECURITY: This function is a pure, deterministic function of
 * `feedbackCategory`. The optional `_untrustedText` argument is
 * intentionally accepted and IGNORED — the classifier must never
 * interpret user-supplied free-text as instruction. The signature
 * accepts the argument so callers can pass it without restructuring,
 * but the value is not read.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function classify(
  feedbackCategory: FeedbackCategory,
  _untrustedText?: string,
): FeedbackSuggestion {
  const result = categoryToFailureClass(feedbackCategory);
  return {
    category: result.category,
    confidence: result.confidence,
    rationale: result.rationale,
  };
}
