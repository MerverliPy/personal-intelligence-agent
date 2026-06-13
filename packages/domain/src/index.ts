export type {
  WorkspaceRole,
  Permission,
  Decision,
  ReasonCode,
  AuthorizationContext,
  AuthorizationDecision,
  WorkspaceMembership,
  ProjectMembership,
  WorkspaceSummary,
  ProjectSummary,
} from './authorization.js';

export { roleAtLeast, ALL_WORKSPACE_ROLES } from './authorization.js';

export {
  FAILURE_CLASSIFICATION,
  FAILURE_CLASSIFICATION_LABELS,
  isValidFailureClass,
  type FailureClass,
} from './failure-taxonomy.js';
