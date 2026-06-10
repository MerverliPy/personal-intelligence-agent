/**
 * Workspace roles match the `workspace_role` PostgreSQL enum.
 *
 * Hierarchy (highest to lowest):
 *   OWNER > ADMIN > CURATOR > MEMBER > AUDITOR
 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'CURATOR' | 'MEMBER' | 'AUDITOR';

/** Ordered from most to least privileged for comparison. */
const ROLE_HIERARCHY: readonly WorkspaceRole[] = ['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR'];

/**
 * Returns `true` when `role` is at least as privileged as `minimum`.
 * OWNER >= ADMIN >= CURATOR >= MEMBER >= AUDITOR.
 */
export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  const roleIdx = ROLE_HIERARCHY.indexOf(role);
  const minIdx = ROLE_HIERARCHY.indexOf(minimum);
  return roleIdx !== -1 && minIdx !== -1 && roleIdx <= minIdx;
}

/**
 * All roles available in the system.
 */
export const ALL_WORKSPACE_ROLES: readonly WorkspaceRole[] = ROLE_HIERARCHY;

// ---------------------------------------------------------------------------
// Authorization context and decisions
// ---------------------------------------------------------------------------

/** A named permission action, e.g. `workspace:read`, `project:manage_members`. */
export type Permission = string;

/** Outcome of an authorization decision. */
export type Decision = 'allow' | 'deny' | 'approval_required';

/** Stable reason codes returned with policy decisions. */
export type ReasonCode =
  | 'authenticated'
  | 'owner'
  | 'admin'
  | 'curator'
  | 'member'
  | 'auditor'
  | 'insufficient_role'
  | 'not_member'
  | 'workspace_not_found'
  | 'project_not_found'
  | 'cross_workspace'
  | 'restricted_project'
  | 'unknown_permission'
  | 'deny_by_default';

/**
 * Input to the authorization policy engine.
 *
 * At minimum a `userId` and `permission` are required. Workspace and project
 * context are optional — cross-cutting actions (e.g. listing workspaces for
 * the authenticated user) may not carry a workspace scope.
 */
export interface AuthorizationContext {
  /** Internal user ID (UUID). */
  userId: string;
  /** Requested permission, e.g. `workspace:read`. */
  permission: Permission;
  /** Workspace scope of the requested operation. */
  workspaceId?: string;
  /** Project scope of the requested operation. */
  projectId?: string;
  /** Optional resource type for richer policy decisions. */
  resourceType?: string;
  /** Optional resource identifier for object-level authorization. */
  resourceId?: string;
}
export interface AuthorizationDecision {
  /** The outcome. */
  decision: Decision;
  /** Machine-readable reason. */
  reasonCode: ReasonCode;
  /** Human-readable explanation (safe for client exposure). */
  message: string;
}

// ---------------------------------------------------------------------------
// Membership record
// ---------------------------------------------------------------------------

/** A resolved membership row from the database. */
export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
}

/** A resolved project membership row from the database. */
export interface ProjectMembership {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: WorkspaceRole;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
}

/** Summary of a workspace visible to a user. */
export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  status: string;
}

/** Summary of a project visible to a user. */
export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
  sensitivity?: string;
}
