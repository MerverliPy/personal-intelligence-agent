export { createPool } from './client.js';
export {
  runMigrations,
  loadMigrations,
  defaultMigrationsDir,
  type Migration,
  type MigrationResult,
} from './migrate.js';
export { getWorkspaceMembership, getProjectMembership } from './membership.js';

// Re-export the failure classification taxonomy so downstream packages
// (notably @pia/ai) can depend on @pia/db alone for the taxonomy.
export {
  FAILURE_CLASSIFICATION,
  FAILURE_CLASSIFICATION_LABELS,
  isValidFailureClass,
  type FailureClass,
} from '@pia/domain';

// Conversations
export {
  createConversation,
  getConversation,
  listConversations,
  archiveConversation,
  deleteConversation,
  type ConversationRow,
  type ConversationMode,
  type SensitivityClass,
  type CreateConversationInput,
} from './conversations.js';

// Messages
export {
  createMessage,
  getConversationMessages,
  getMessage,
  type PersistedMessage,
  type MessageRole,
  type CreateMessageInput,
} from './messages.js';

// Model runs
export {
  createModelRun,
  startStreaming,
  completeModelRun,
  getModelRun,
  linkRetrievalTraces,
  isValidModelRunTransition,
  isTerminalModelRunStatus,
  ModelRunTransitionError,
  type ModelRunRow,
  type ModelRunStatus,
  type CreateModelRunInput,
} from './runs.js';

// Citations
export {
  createCitation,
  getCitationsForMessage,
  getCitationsForModelRun,
  updateCitationVerification,
  type CitationRow,
  type CreateCitationInput,
} from './citations.js';

// Feedback
export {
  createFeedback,
  getFeedbackForMessage,
  getFeedback,
  setFeedbackSuggestion,
  type FeedbackRow,
  type FeedbackCategory,
  type CreateFeedbackInput,
} from './feedback.js';

// Feedback retrieval-trace links
export {
  addFeedbackRetrievalTraces,
  getFeedbackRetrievalTraces,
  deleteFeedbackRetrievalTraces,
  MAX_FEEDBACK_RETRIEVAL_TRACES,
  type FeedbackRetrievalTraceRow,
} from './feedback-retrieval-traces.js';
