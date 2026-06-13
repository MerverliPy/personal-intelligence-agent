// ---------------------------------------------------------------------------
// Failure taxonomy mapping (P3-T08 / FR-FBK-003)
// ---------------------------------------------------------------------------
// Maps feedback categories to the FR-FBK-003 failure classification
// taxonomy defined in @pia/domain. This is a deterministic, rule-based
// mapping used by the MVP classifier. LLM-driven classification is
// deferred to P6-T03.
// ---------------------------------------------------------------------------

import { FAILURE_CLASSIFICATION, type FailureClass } from '@pia/db';
import type { FeedbackCategory } from './categories.js';

/**
 * Result of mapping a feedback category to a failure classification.
 * `category` is `null` for feedback that does not imply a failure
 * (POSITIVE, FREE_TEXT) or when the input is unclassifiable.
 */
export interface CategoryToFailureClassResult {
  readonly category: FailureClass | null;
  readonly confidence: number;
  readonly rationale: string;
}

/**
 * Deterministic rule-based mapping from feedback category to the
 * FR-FBK-003 failure classification taxonomy.
 *
 * - POSITIVE and FREE_TEXT return `null` (no failure implied).
 * - All other categories map to a single best-guess failure class
 *   with a fixed, conservative confidence of 0.5. This is a deliberate
 *   MVP placeholder; the LLM-driven classifier in P6-T03 will replace
 *   the mapping with model-based reasoning.
 *
 * SECURITY: This function ignores the contents of any free-text
 * correction/notes. The category alone drives the mapping. The
 * classifier MUST NEVER interpret user-supplied text as instruction.
 */
export function categoryToFailureClass(
  feedbackCategory: FeedbackCategory,
): CategoryToFailureClassResult {
  switch (feedbackCategory) {
    case 'POSITIVE':
      return {
        category: null,
        confidence: 0,
        rationale: 'Positive feedback does not imply a failure class.',
      };
    case 'FREE_TEXT':
      return {
        category: null,
        confidence: 0,
        rationale: 'Free-text feedback does not imply a failure class.',
      };
    case 'NEGATIVE':
      return {
        category: FAILURE_CLASSIFICATION.MODEL_LIMITATION,
        confidence: 0.5,
        rationale:
          'Negative feedback suggests a general model limitation; specific class requires LLM reasoning (P6-T03).',
      };
    case 'INCORRECT':
      return {
        category: FAILURE_CLASSIFICATION.REASONING,
        confidence: 0.5,
        rationale:
          'Incorrect feedback most often indicates a reasoning error; specific class requires LLM reasoning (P6-T03).',
      };
    case 'INCOMPLETE':
      return {
        category: FAILURE_CLASSIFICATION.KNOWLEDGE_MISSING,
        confidence: 0.5,
        rationale:
          'Incomplete feedback most often indicates missing knowledge; specific class requires LLM reasoning (P6-T03).',
      };
    case 'CITATION_ISSUE':
      return {
        category: FAILURE_CLASSIFICATION.CITATION,
        confidence: 0.7,
        rationale: 'Citation-issue feedback is directly attributable to the citation subsystem.',
      };
    case 'STYLE_ISSUE':
      return {
        category: FAILURE_CLASSIFICATION.UI,
        confidence: 0.4,
        rationale:
          'Style-issue feedback may indicate presentation or formatting concerns; specific class requires LLM reasoning (P6-T03).',
      };
    case 'UNSAFE':
      return {
        category: FAILURE_CLASSIFICATION.SAFETY,
        confidence: 0.8,
        rationale: 'Unsafe feedback is directly attributable to the safety subsystem.',
      };
  }
}
