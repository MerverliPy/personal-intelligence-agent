// ---------------------------------------------------------------------------
// Feedback module barrel (P3-T08)
// ---------------------------------------------------------------------------

export { FEEDBACK_CATEGORIES, isFeedbackCategory, type FeedbackCategory } from './categories.js';

export { categoryToFailureClass, type CategoryToFailureClassResult } from './failureTaxonomy.js';

export { classify, type FeedbackSuggestion } from './classifier.js';

export { submitFeedback, type SubmitFeedbackInput, type SubmitFeedbackResult } from './service.js';
