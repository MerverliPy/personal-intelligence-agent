import type { Pool } from 'pg';
import type {
  WorkspaceRole,
  WorkspaceMembership,
  ProjectMembership,
  WorkspaceSummary,
  ProjectSummary,
} from '@pia/domain';

// ---------------------------------------------------------------------------
// Workspace membership queries
// ---------------------------------------------------------------------------

/**
 * Returns the membership record for a user in a workspace, or null if
 * they are not an active member.
 */
export async function getWorkspaceMembership(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMembership | null> {
  const result = await pool.query<{
    workspace_id: string;
    user_id: string;
    role: WorkspaceRole;
    status: string;
  }>(
    `SELECT workspace_id, user_id, role, status::text AS status
     FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [workspaceId, userId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    status: row.status as WorkspaceMembership['status'],
  };
}

/**
 * Lists all active workspace members for a given workspace.
 */
export async function listWorkspaceMembers(
  pool: Pool,
  workspaceId: string,
): Promise<WorkspaceMembership[]> {
  const result = await pool.query<{
    workspace_id: string;
    user_id: string;
    role: WorkspaceRole;
    status: string;
  }>(
    `SELECT workspace_id, user_id, role, status::text AS status
     FROM workspace_members
     WHERE workspace_id = $1 AND status = 'ACTIVE'
     ORDER BY role, user_id`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    status: row.status as WorkspaceMembership['status'],
  }));
}

// ---------------------------------------------------------------------------
// Project membership queries
// ---------------------------------------------------------------------------

/**
 * Returns the project membership for a user, or null if not an active member.
 * The user must also be an active workspace member (enforced by FK).
 */
export async function getProjectMembership(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<ProjectMembership | null> {
  const result = await pool.query<{
    workspace_id: string;
    project_id: string;
    user_id: string;
    role: WorkspaceRole;
    status: string;
  }>(
    `SELECT workspace_id, project_id, user_id, role, status::text AS status
     FROM project_members
     WHERE project_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [projectId, userId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    status: row.status as ProjectMembership['status'],
  };
}

// ---------------------------------------------------------------------------
// Listing workspaces and projects for a user
// ---------------------------------------------------------------------------

/**
 * Returns all workspaces a user is an active member of.
 */
export async function listWorkspacesForUser(
  pool: Pool,
  userId: string,
): Promise<WorkspaceSummary[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    role: WorkspaceRole;
    status: string;
  }>(
    `SELECT w.id, w.name, wm.role, w.status
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = $1
       AND wm.status = 'ACTIVE'
       AND w.deleted_at IS NULL
     ORDER BY w.name`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
  }));
}

/**
 * Returns all projects within a workspace that a user is an active member of.
 */
export async function listProjectsForUser(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<ProjectSummary[]> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    name: string;
    role: WorkspaceRole;
    sensitivity: string | null;
  }>(
    `SELECT p.id, p.workspace_id, p.name, pm.role, p.sensitivity::text AS sensitivity
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1
       AND p.workspace_id = $2
       AND pm.status = 'ACTIVE'
       AND p.deleted_at IS NULL
     ORDER BY p.name`,
    [userId, workspaceId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    role: row.role,
    ...(row.sensitivity !== null && row.sensitivity !== undefined
      ? { sensitivity: row.sensitivity }
      : {}),
  }));
}
