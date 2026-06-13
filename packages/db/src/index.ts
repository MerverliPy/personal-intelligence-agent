export { createPool } from './client.js';
export {
  runMigrations,
  loadMigrations,
  defaultMigrationsDir,
  type Migration,
  type MigrationResult,
} from './migrate.js';
export { getWorkspaceMembership, getProjectMembership } from './membership.js';

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
  type FeedbackRow,
  type FeedbackCategory,
  type CreateFeedbackInput,
} from './feedback.js';
