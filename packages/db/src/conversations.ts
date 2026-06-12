// ---------------------------------------------------------------------------
// Conversation domain types and repository
// ---------------------------------------------------------------------------
// Per P3-T04: conversations are workspace/project-scoped with sensitivity
// classification. Repository functions enforce workspace isolation.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';

/**
 * Valid conversation modes matching the `conversation_mode` PostgreSQL enum.
 */
export type ConversationMode = 'ASK' | 'RESEARCH' | 'ANALYZE' | 'PLAN' | 'EXECUTE' | 'LEARN';

/**
 * Sensitivity classification matching the `sensitivity_class` PostgreSQL enum.
 */
export type SensitivityClass =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'HIGHLY_CONFIDENTIAL'
  | 'REGULATED'
  | 'PROHIBITED';

/**
 * A persisted conversation row.
 */
export interface ConversationRow {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string | null;
  mode: ConversationMode;
  sensitivity: SensitivityClass;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

/**
 * Input for creating a new conversation.
 */
export interface CreateConversationInput {
  projectId?: string | null;
  title?: string | null;
  mode?: ConversationMode;
  sensitivity?: SensitivityClass;
}

/**
 * Creates a new conversation scoped to the given workspace.
 */
export async function createConversation(
  pool: Pool,
  workspaceId: string,
  userId: string,
  input: CreateConversationInput,
): Promise<ConversationRow> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    project_id: string | null;
    title: string | null;
    mode: ConversationMode;
    sensitivity: SensitivityClass;
    created_by: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    deleted_at: string | null;
  }>(
    `INSERT INTO conversations
       (workspace_id, project_id, title, mode, sensitivity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      workspaceId,
      input.projectId ?? null,
      input.title ?? null,
      input.mode ?? 'ASK',
      input.sensitivity ?? 'INTERNAL',
      userId,
    ],
  );
  const row = result.rows[0]!;
  return toConversationRow(row);
}

/**
 * Retrieves a single conversation by ID, scoped to the given workspace.
 * Returns null if not found or if the conversation belongs to a different workspace.
 */
export async function getConversation(
  pool: Pool,
  workspaceId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const result = await pool.query<DbConversation>(
    `SELECT * FROM conversations
     WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`,
    [conversationId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return toConversationRow(result.rows[0]!);
}

/**
 * Lists conversations for a workspace, optionally filtered by project.
 * Ordered by most recently updated first.
 */
export async function listConversations(
  pool: Pool,
  workspaceId: string,
  options?: { projectId?: string; limit?: number; offset?: number },
): Promise<ConversationRow[]> {
  const conditions = ['workspace_id = $1', 'deleted_at IS NULL'];
  const params: (string | number)[] = [workspaceId];
  let paramIdx = 2;

  if (options?.projectId) {
    conditions.push(`project_id = $${paramIdx}`);
    params.push(options.projectId);
    paramIdx++;
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const result = await pool.query<DbConversation>(
    `SELECT * FROM conversations
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return result.rows.map(toConversationRow);
}

/**
 * Archives a conversation (soft-delete via archived_at).
 * Only the owning workspace can archive.
 */
export async function archiveConversation(
  pool: Pool,
  workspaceId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const result = await pool.query<DbConversation>(
    `UPDATE conversations
     SET archived_at = now(), updated_at = now()
     WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND archived_at IS NULL
     RETURNING *`,
    [conversationId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return toConversationRow(result.rows[0]!);
}

/**
 * Soft-deletes a conversation (sets deleted_at).
 * Only the owning workspace can delete.
 */
export async function deleteConversation(
  pool: Pool,
  workspaceId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const result = await pool.query<DbConversation>(
    `UPDATE conversations
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [conversationId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return toConversationRow(result.rows[0]!);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DbConversation = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string | null;
  mode: ConversationMode;
  sensitivity: SensitivityClass;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

function toConversationRow(row: DbConversation): ConversationRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    title: row.title,
    mode: row.mode,
    sensitivity: row.sensitivity,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
  };
}
