// ---------------------------------------------------------------------------
// Message domain types and repository
// ---------------------------------------------------------------------------
// Per P3-T04: messages are immutable after creation. Only INSERT operations
// are exposed; no UPDATE or DELETE paths exist for messages.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';

/**
 * Valid message roles matching the `message_role` PostgreSQL enum.
 *
 * Mapping to model-gateway roles:
 *   USER        => 'user'
 *   ASSISTANT   => 'assistant'
 *   SYSTEM_NOTE => 'system'
 *   TOOL        => 'tool'
 */
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM_NOTE' | 'TOOL';

/**
 * A persisted message row. Named `PersistedMessage` to avoid collision
 * with the model-gateway `Message` type in `@pia/ai`.
 */
export interface PersistedMessage {
  id: string;
  workspaceId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  contentMetadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Input for creating a new message.
 */
export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  contentMetadata?: Record<string, unknown>;
  createdBy?: string | null;
}

/**
 * Creates a new message scoped to the given workspace.
 * Messages are immutable after creation — no update/delete paths exist.
 */
export async function createMessage(
  pool: Pool,
  workspaceId: string,
  input: CreateMessageInput,
): Promise<PersistedMessage> {
  const result = await pool.query<DbMessage>(
    `INSERT INTO messages
       (workspace_id, conversation_id, role, content, content_metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      workspaceId,
      input.conversationId,
      input.role,
      input.content,
      JSON.stringify(input.contentMetadata ?? {}),
      input.createdBy ?? null,
    ],
  );
  return toPersistedMessage(result.rows[0]!);
}

/**
 * Retrieves all messages for a conversation in chronological order.
 */
export async function getConversationMessages(
  pool: Pool,
  workspaceId: string,
  conversationId: string,
  options?: { limit?: number; before?: string },
): Promise<PersistedMessage[]> {
  const params: (string | number)[] = [workspaceId, conversationId];
  let paramIdx = 3;

  let query = `
    SELECT m.* FROM messages m
    WHERE m.workspace_id = $1
      AND m.conversation_id = $2
  `;

  if (options?.before) {
    query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${paramIdx})`;
    params.push(options.before);
    paramIdx++;
  }

  query += ` ORDER BY m.created_at ASC, m.id ASC`;

  const limit = options?.limit ?? 200;
  query += ` LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await pool.query<DbMessage>(query, params);
  return result.rows.map(toPersistedMessage);
}

/**
 * Retrieves a single message by ID scoped to the given workspace.
 * Returns null if not found or cross-workspace.
 */
export async function getMessage(
  pool: Pool,
  workspaceId: string,
  messageId: string,
): Promise<PersistedMessage | null> {
  const result = await pool.query<DbMessage>(
    `SELECT * FROM messages
     WHERE id = $1 AND workspace_id = $2`,
    [messageId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return toPersistedMessage(result.rows[0]!);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DbMessage = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  content_metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

function toPersistedMessage(row: DbMessage): PersistedMessage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    contentMetadata: row.content_metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
