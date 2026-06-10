import type { Pool } from 'pg';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type WorkspaceRole,
  type AuthorizationContext,
  type AuthorizationDecision,
  type WorkspaceMembership,
  type ProjectMembership,
  roleAtLeast,
} from '@pia/domain';
import { getWorkspaceMembership, getProjectMembership } from '@pia/db';
import type { SessionData } from './types.js';

// ---------------------------------------------------------------------------
// Permission → minimum role mapping
// ---------------------------------------------------------------------------

/**
 * Maps a permission string to the minimum workspace role required.
 *
 * Permissions not listed here are **denied by default**.
 */
export const WORKSPACE_PERMISSION_ROLE: Record<string, WorkspaceRole> = {
  'workspace:read': 'AUDITOR',
  'workspace:update': 'ADMIN',
  'workspace:delete': 'OWNER',
  'workspace:manage_members': 'ADMIN',
  'project:create': 'ADMIN',
  'project:read': 'AUDITOR',
  'project:update': 'CURATOR',
  'project:delete': 'ADMIN',
  'project:manage_members': 'ADMIN',
  'knowledge:read': 'AUDITOR',
  'knowledge:write': 'MEMBER',
  'knowledge:curate': 'CURATOR',
  'knowledge:delete': 'ADMIN',
  'audit:read': 'AUDITOR',
  'member:read': 'AUDITOR',
};

// ---------------------------------------------------------------------------
// Membership provider interface (for dependency inversion)
// ---------------------------------------------------------------------------

/**
 * Abstract membership lookup that the policy engine depends on.
 *
 * The default implementation uses `@pia/db`; tests can supply a fake.
 */
export interface MembershipProvider {
  getWorkspaceMembership(workspaceId: string, userId: string): Promise<WorkspaceMembership | null>;
  getProjectMembership(projectId: string, userId: string): Promise<ProjectMembership | null>;
}

/**
 * Creates a {@link MembershipProvider} backed by a PostgreSQL pool.
 */
export function createPoolMembershipProvider(pool: Pool): MembershipProvider {
  return {
    getWorkspaceMembership: (workspaceId, userId) =>
      getWorkspaceMembership(pool, workspaceId, userId),
    getProjectMembership: (projectId, userId) => getProjectMembership(pool, projectId, userId),
  };
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a principal is authorized to perform an action.
 *
 * Per the security spec (§4), policy decisions return allow/deny/approval-required
 * plus a stable reason code. Model output cannot override the result.
 *
 * Deny-by-default for any permission not in the mapping.
 */
export async function evaluatePolicy(
  membership: MembershipProvider,
  context: AuthorizationContext,
): Promise<AuthorizationDecision> {
  // 1. Look up the minimum required role for this permission.
  const requiredRole = WORKSPACE_PERMISSION_ROLE[context.permission];

  if (!requiredRole) {
    return {
      decision: 'deny',
      reasonCode: 'unknown_permission',
      message: `Permission '${context.permission}' is not recognized.`,
    };
  }

  // 2. Determine the effective role of the principal in this scope.
  let effectiveRole: WorkspaceRole | null = null;

  if (context.projectId) {
    // Project-scoped: membership in the project is required (which implies
    // workspace membership through the FK).
    const pm = await membership.getProjectMembership(context.projectId, context.userId);
    if (!pm) {
      return {
        decision: 'deny',
        reasonCode: 'not_member',
        message: 'Not a member of this project.',
      };
    }
    // If a workspaceId was also supplied, verify it matches.
    if (context.workspaceId && pm.workspaceId !== context.workspaceId) {
      return {
        decision: 'deny',
        reasonCode: 'cross_workspace',
        message: 'Project does not belong to the specified workspace.',
      };
    }
    effectiveRole = pm.role;
  } else if (context.workspaceId) {
    // Workspace-scoped: membership in the workspace is required.
    const wm = await membership.getWorkspaceMembership(context.workspaceId, context.userId);
    if (!wm) {
      return {
        decision: 'deny',
        reasonCode: 'not_member',
        message: 'Not a member of this workspace.',
      };
    }
    effectiveRole = wm.role;
  } else {
    // No workspace/project scope — only a subset of permissions apply.
    // User-scoped actions (e.g. listing own workspaces) are handled by the
    // route layer directly by filtering on userId. Cross-cutting system
    // permissions are denied by default here.
    return {
      decision: 'deny',
      reasonCode: 'deny_by_default',
      message: 'No workspace or project scope provided.',
    };
  }

  // 3. Evaluate role sufficiency.
  if (roleAtLeast(effectiveRole, requiredRole)) {
    return {
      decision: 'allow',
      reasonCode: effectiveRole.toLowerCase() as AuthorizationDecision['reasonCode'],
      message: 'Access granted.',
    };
  }

  return {
    decision: 'deny',
    reasonCode: 'insufficient_role',
    message: `Role '${effectiveRole}' is insufficient for '${context.permission}' (requires '${requiredRole}').`,
  };
}

// ---------------------------------------------------------------------------
// Authorization middleware (framework-agnostic, raw Node.js HTTP)
// ---------------------------------------------------------------------------

/** Extended request with authenticated session. */
export interface AuthorizedRequest extends IncomingMessage {
  session?: SessionData;
}

/**
 * Options for the `requireAuthorization` middleware.
 */
export interface RequireAuthorizationOptions {
  /** The permission required, e.g. `workspace:read`. */
  permission: string;
  /**
   * How to extract the workspace ID from the request.
   *
   * A custom function → return the workspaceId (or undefined).
   */
  getWorkspaceId?: (req: AuthorizedRequest) => string | undefined;
  /**
   * How to extract the project ID from the request.
   */
  getProjectId?: (req: AuthorizedRequest) => string | undefined;
}

/**
 * Middleware that enforces authorization on incoming requests.
 *
 * This is a thin wrapper around {@link evaluatePolicy}. It extracts the
 * authenticated principal from `req.session` (set by the auth middleware
 * from P1-T02) and constructs an {@link AuthorizationContext}.
 *
 * Returns `true` if authorized. Returns `false` and writes a 403 response
 * with a non-disclosing denial if the user is not authorized.
 *
 * @example
 * ```ts
 * // With a raw Node.js server
 * if (await requireAuthorization(req, res, membership, {
 *   permission: 'workspace:read',
 *   getWorkspaceId: (req) => req.url?.split('/')[3],
 * })) {
 *   // Handle request
 * }
 * ```
 */
export async function requireAuthorization(
  req: AuthorizedRequest,
  res: ServerResponse,
  membership: MembershipProvider,
  options: RequireAuthorizationOptions,
): Promise<boolean> {
  const session = req.session;
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized', message: 'Authentication required.' }));
    return false;
  }

  const workspaceId = options.getWorkspaceId?.(req);
  const projectId = options.getProjectId?.(req);

  const context: AuthorizationContext = {
    userId: session.userId,
    permission: options.permission,
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
  };

  const decision = await evaluatePolicy(membership, context);

  if (decision.decision !== 'allow') {
    // Per §4 of the security spec: unauthorized access returns a
    // non-disclosing denial.
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'forbidden',
        message: 'Access denied.',
        reason: decision.reasonCode,
      }),
    );
    return false;
  }

  return true;
}
