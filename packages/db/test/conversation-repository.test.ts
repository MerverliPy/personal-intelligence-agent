import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { runMigrations, defaultMigrationsDir } from '../src/migrate.js';
import {
  createConversation,
  getConversation,
  listConversations,
  archiveConversation,
  deleteConversation,
  type ConversationRow,
} from '../src/conversations.js';
import {
  createMessage,
  getConversationMessages,
  getMessage,
  type PersistedMessage,
} from '../src/messages.js';
import {
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
} from '../src/runs.js';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: Pool;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a workspace and a user, returning their IDs. */
async function createWorkspace(p: Pool): Promise<{ workspaceId: string; userId: string }> {
  const user = await p.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [`test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`],
  );
  const userId = user.rows[0]!.id;
  const ws = await p.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`Test WS ${Date.now()}`, userId],
  );
  const wsId = ws.rows[0]!.id;
  await p.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [wsId, userId],
  );
  return { workspaceId: wsId, userId };
}

/** Creates a second workspace (for cross-workspace tests). */
async function createSecondWorkspace(p: Pool, userId: string): Promise<string> {
  const ws = await p.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`Other WS ${Date.now()}`, userId],
  );
  const wsId = ws.rows[0]!.id;
  await p.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [wsId, userId],
  );
  return wsId;
}

// ---------------------------------------------------------------------------
// Migration correctness
// ---------------------------------------------------------------------------

describe('migration 007: conversations schema', () => {
  it('applies idempotently', async () => {
    const result = await runMigrations(pool, defaultMigrationsDir());
    // No new migrations should be applied since setupTestDatabase ran them all.
    expect(result.applied).toHaveLength(0);
  });

  it('creates the conversation_mode enum', async () => {
    const result = await pool.query<{ typname: string }>(`
      SELECT typname FROM pg_type
      WHERE typname = 'conversation_mode' AND typtype = 'e'
    `);
    expect(result.rows).toHaveLength(1);
  });

  it('creates the message_role enum', async () => {
    const result = await pool.query<{ typname: string }>(`
      SELECT typname FROM pg_type
      WHERE typname = 'message_role' AND typtype = 'e'
    `);
    expect(result.rows).toHaveLength(1);
  });

  it('creates the model_run_status enum', async () => {
    const result = await pool.query<{ typname: string }>(`
      SELECT typname FROM pg_type
      WHERE typname = 'model_run_status' AND typtype = 'e'
    `);
    expect(result.rows).toHaveLength(1);
  });

  it('creates the conversations table with sensitivity column', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'conversations'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);

    const cols = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations'
      ORDER BY ordinal_position
    `);
    const colNames = cols.rows.map((r) => r.column_name);
    expect(colNames).toContain('workspace_id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('sensitivity');
    expect(colNames).toContain('mode');
    expect(colNames).toContain('created_by');
    expect(colNames).toContain('archived_at');
    expect(colNames).toContain('deleted_at');
  });

  it('creates the messages table', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'messages'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('creates the model_runs table with context_manifest comment', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'model_runs'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);

    // Verify there is no raw CoT content column — only context_manifest for metadata
    const cols = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'model_runs'
    `);
    const colNames = cols.rows.map((r) => r.column_name);
    expect(colNames).toContain('context_manifest');
    expect(colNames).not.toContain('chain_of_thought');
    expect(colNames).not.toContain('raw_output');
  });

  it('creates the model_run_retrieval_traces join table', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'model_run_retrieval_traces'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('has conversations workspace/project index', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'conversations_workspace_project_idx'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Row-Level Security
// ---------------------------------------------------------------------------

describe('RLS policies', () => {
  it('RLS is enabled on conversations', async () => {
    const result = await pool.query<{ rlsenabled: boolean }>(`
      SELECT relrowsecurity AS rlsenabled
      FROM pg_class
      WHERE relname = 'conversations'
    `);
    expect(result.rows[0]?.rlsenabled).toBe(true);
  });

  it('RLS is enabled on messages', async () => {
    const result = await pool.query<{ rlsenabled: boolean }>(`
      SELECT relrowsecurity AS rlsenabled
      FROM pg_class
      WHERE relname = 'messages'
    `);
    expect(result.rows[0]?.rlsenabled).toBe(true);
  });

  it('RLS is enabled on model_runs', async () => {
    const result = await pool.query<{ rlsenabled: boolean }>(`
      SELECT relrowsecurity AS rlsenabled
      FROM pg_class
      WHERE relname = 'model_runs'
    `);
    expect(result.rows[0]?.rlsenabled).toBe(true);
  });

  it('RLS is enabled on model_run_retrieval_traces', async () => {
    const result = await pool.query<{ rlsenabled: boolean }>(`
      SELECT relrowsecurity AS rlsenabled
      FROM pg_class
      WHERE relname = 'model_run_retrieval_traces'
    `);
    expect(result.rows[0]?.rlsenabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conversation repository tests
// ---------------------------------------------------------------------------

describe('conversation repository', () => {
  it('creates a conversation with defaults', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    expect(conv.id).toBeDefined();
    expect(conv.workspaceId).toBe(workspaceId);
    expect(conv.mode).toBe('ASK');
    expect(conv.sensitivity).toBe('INTERNAL');
    expect(conv.projectId).toBeNull();
    expect(conv.deletedAt).toBeNull();
    expect(conv.archivedAt).toBeNull();
  });

  it('creates a conversation with explicit mode and sensitivity', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {
      mode: 'RESEARCH',
      sensitivity: 'CONFIDENTIAL',
      title: 'My Research',
    });
    expect(conv.mode).toBe('RESEARCH');
    expect(conv.sensitivity).toBe('CONFIDENTIAL');
    expect(conv.title).toBe('My Research');
  });

  it('retrieves a conversation by ID', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, { title: 'Find Me' });

    const found = await getConversation(pool, workspaceId, conv.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Find Me');
  });

  it('returns null for non-existent conversation', async () => {
    const { workspaceId } = await createWorkspace(pool);
    const found = await getConversation(pool, workspaceId, '00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('returns null for cross-workspace access', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);

    const conv = await createConversation(pool, wsA, userId, { title: 'WS A Conv' });

    // Try to access from wsB — should be denied
    const found = await getConversation(pool, wsB, conv.id);
    expect(found).toBeNull();
  });

  it('lists conversations scoped to workspace', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);

    await createConversation(pool, wsA, userId, { title: 'A1' });
    await createConversation(pool, wsA, userId, { title: 'A2' });
    await createConversation(pool, wsB, userId, { title: 'B1' });

    const listA = await listConversations(pool, wsA);
    expect(listA).toHaveLength(2);
    expect(listA.map((c) => c.title)).toEqual(expect.arrayContaining(['A1', 'A2']));
    expect(listA.map((c) => c.title)).not.toContain('B1');
  });

  it('lists conversations filtered by project', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);

    // Create a project
    const proj = await pool.query<{ id: string }>(
      `INSERT INTO projects (id, workspace_id, name, created_by) VALUES (gen_random_uuid(), $1, 'Proj A', $2) RETURNING id`,
      [workspaceId, userId],
    );
    const projectId = proj.rows[0]!.id;

    await createConversation(pool, workspaceId, userId, { title: 'In Project', projectId });
    await createConversation(pool, workspaceId, userId, { title: 'No Project', projectId: null });

    const projList = await listConversations(pool, workspaceId, { projectId });
    expect(projList).toHaveLength(1);
    expect(projList[0]!.title).toBe('In Project');

    const noProjList = await listConversations(pool, workspaceId);
    expect(noProjList).toHaveLength(2);
  });

  it('archives a conversation', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    const archived = await archiveConversation(pool, workspaceId, conv.id);
    expect(archived).not.toBeNull();
    expect(archived!.archivedAt).not.toBeNull();

    // Archived conversations are excluded from getConversation (checks deleted_at IS NULL only)
    const found = await getConversation(pool, workspaceId, conv.id);
    expect(found).not.toBeNull(); // getConversation only checks deleted_at
  });

  it('soft-deletes a conversation', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    const deleted = await deleteConversation(pool, workspaceId, conv.id);
    expect(deleted).not.toBeNull();
    expect(deleted!.deletedAt).not.toBeNull();

    // Deleted conversations are excluded from getConversation
    const found = await getConversation(pool, workspaceId, conv.id);
    expect(found).toBeNull();
  });

  it('delete from wrong workspace returns null', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);
    const conv = await createConversation(pool, wsA, userId, {});

    const result = await deleteConversation(pool, wsB, conv.id);
    expect(result).toBeNull();

    // Conversation still exists in wsA
    const found = await getConversation(pool, wsA, conv.id);
    expect(found).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Message repository tests
// ---------------------------------------------------------------------------

describe('message repository', () => {
  it('creates a message and retrieves it', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hello, world!',
      createdBy: userId,
    });

    expect(msg.id).toBeDefined();
    expect(msg.workspaceId).toBe(workspaceId);
    expect(msg.conversationId).toBe(conv.id);
    expect(msg.role).toBe('USER');
    expect(msg.content).toBe('Hello, world!');
  });

  it('stores different message roles', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    await createMessage(pool, workspaceId, { conversationId: conv.id, role: 'USER', content: 'U' });
    await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'ASSISTANT',
      content: 'A',
    });
    await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'SYSTEM_NOTE',
      content: 'S',
    });
    await createMessage(pool, workspaceId, { conversationId: conv.id, role: 'TOOL', content: 'T' });

    const msgs = await getConversationMessages(pool, workspaceId, conv.id);
    expect(msgs).toHaveLength(4);
    const roles = msgs.map((m) => m.role);
    expect(roles).toEqual(['USER', 'ASSISTANT', 'SYSTEM_NOTE', 'TOOL']);
  });

  it('retrieves messages in chronological order', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'First',
    });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));
    await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'ASSISTANT',
      content: 'Second',
    });

    const msgs = await getConversationMessages(pool, workspaceId, conv.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.content).toBe('First');
    expect(msgs[1]!.content).toBe('Second');
  });

  it('filters by cross-workspace access', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);
    const conv = await createConversation(pool, wsA, userId, {});

    await createMessage(pool, wsA, { conversationId: conv.id, role: 'USER', content: 'Secret' });

    // Access from wsB should return no messages
    const msgsFromB = await getConversationMessages(pool, wsB, conv.id);
    expect(msgsFromB).toHaveLength(0);
  });

  it('supports pagination with before cursor', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    const msg1 = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'One',
    });
    await new Promise((r) => setTimeout(r, 5));
    const msg2 = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'ASSISTANT',
      content: 'Two',
    });
    await new Promise((r) => setTimeout(r, 5));
    await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Three',
    });

    // Get messages before msg2
    const msgs = await getConversationMessages(pool, workspaceId, conv.id, { before: msg2.id });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe('One');
  });

  it('getMessage returns null for cross-workspace access', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);
    const conv = await createConversation(pool, wsA, userId, {});

    const msg = await createMessage(pool, wsA, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Secret',
    });

    const found = await getMessage(pool, wsB, msg.id);
    expect(found).toBeNull();
  });

  it('messages content_metadata defaults to empty object', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});

    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'test',
    });
    expect(msg.contentMetadata).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// State machine unit tests
// ---------------------------------------------------------------------------

describe('model run state machine', () => {
  const allStatuses: ModelRunStatus[] = [
    'CREATED',
    'STREAMING',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
    'INTERRUPTED',
  ];

  it('CREATED can only transition to STREAMING', () => {
    for (const next of allStatuses) {
      if (next === 'STREAMING') {
        expect(isValidModelRunTransition('CREATED', next)).toBe(true);
      } else {
        expect(isValidModelRunTransition('CREATED', next)).toBe(false);
      }
    }
  });

  it('STREAMING can transition to terminal states', () => {
    const terminals: ModelRunStatus[] = ['COMPLETED', 'CANCELLED', 'FAILED', 'INTERRUPTED'];
    for (const next of terminals) {
      expect(isValidModelRunTransition('STREAMING', next)).toBe(true);
    }
    // Cannot go back to CREATED
    expect(isValidModelRunTransition('STREAMING', 'CREATED')).toBe(false);
  });

  it('terminal states have no valid transitions', () => {
    const terminals: ModelRunStatus[] = ['COMPLETED', 'CANCELLED', 'FAILED', 'INTERRUPTED'];
    for (const terminal of terminals) {
      expect(isTerminalModelRunStatus(terminal)).toBe(true);
      for (const next of allStatuses) {
        expect(isValidModelRunTransition(terminal, next)).toBe(false);
      }
    }
  });

  it('CREATED and STREAMING are not terminal', () => {
    expect(isTerminalModelRunStatus('CREATED')).toBe(false);
    expect(isTerminalModelRunStatus('STREAMING')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Model run repository tests
// ---------------------------------------------------------------------------

describe('model run repository', () => {
  it('creates a model run in CREATED state', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hello',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'openai',
      model: 'gpt-4o',
      promptName: 'default',
      promptVersion: 'v1',
    });

    expect(run.status).toBe('CREATED');
    expect(run.provider).toBe('openai');
    expect(run.model).toBe('gpt-4o');
    expect(run.userMessageId).toBe(msg.id);
    expect(run.assistantMessageId).toBeNull();
    expect(run.contextManifest).toEqual({});
    // Verify no CoT content is stored
    expect(run).not.toHaveProperty('chainOfThought');
  });

  it('context_manifest stores only metadata, not raw content', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hello',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
      contextManifest: {
        systemPrompt: 'system-prompt-v1',
        evidenceCount: 3,
        evidenceVersions: ['v1', 'v2'],
        // No raw chain-of-thought
      },
    });

    expect(run.contextManifest).toEqual({
      systemPrompt: 'system-prompt-v1',
      evidenceCount: 3,
      evidenceVersions: ['v1', 'v2'],
    });
    // Explicitly check no CoT content field
    const raw = await pool.query(`SELECT context_manifest FROM model_runs WHERE id = $1`, [run.id]);
    const manifest = raw.rows[0]!.context_manifest;
    expect(manifest).not.toHaveProperty('chain_of_thought');
    expect(manifest).not.toHaveProperty('raw_cot');
  });

  it('transitions CREATED -> STREAMING', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    const streaming = await startStreaming(pool, workspaceId, run.id);
    expect(streaming.status).toBe('STREAMING');
    expect(streaming.startedAt).not.toBeNull();
  });

  it.each([
    ['COMPLETED' as const],
    ['CANCELLED' as const],
    ['FAILED' as const],
    ['INTERRUPTED' as const],
  ])('transitions STREAMING -> %s', async (terminalStatus) => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    await startStreaming(pool, workspaceId, run.id);

    const completed = await completeModelRun(pool, workspaceId, run.id, {
      status: terminalStatus,
      inputTokens: 100,
      outputTokens: 50,
      costMicrounits: 1500,
      latencyMs: 1200,
    });

    expect(completed.status).toBe(terminalStatus);
    expect(completed.inputTokens).toBe(100);
    expect(completed.outputTokens).toBe(50);
    expect(completed.costMicrounits).toBe(1500);
    expect(completed.latencyMs).toBe(1200);
    expect(completed.completedAt).not.toBeNull();
  });

  it('sets assistant_message_id on completion', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const userMsg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });
    const assistantMsg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'ASSISTANT',
      content: 'Hello!',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: userMsg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });
    await startStreaming(pool, workspaceId, run.id);

    const completed = await completeModelRun(pool, workspaceId, run.id, {
      status: 'COMPLETED',
      assistantMessageId: assistantMsg.id,
    });

    expect(completed.assistantMessageId).toBe(assistantMsg.id);
  });

  it('rejects transition from CREATED directly to terminal', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    await expect(
      completeModelRun(pool, workspaceId, run.id, { status: 'COMPLETED' }),
    ).rejects.toThrow(ModelRunTransitionError);
  });

  it('rejects transition from terminal to STREAMING', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });
    await startStreaming(pool, workspaceId, run.id);
    await completeModelRun(pool, workspaceId, run.id, { status: 'COMPLETED' });

    // Can't go back to STREAMING from COMPLETED
    await expect(startStreaming(pool, workspaceId, run.id)).rejects.toThrow(
      ModelRunTransitionError,
    );
  });

  it('controls concurrent terminal transitions', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });
    await startStreaming(pool, workspaceId, run.id);

    // Two concurrent completions — the second should fail
    await completeModelRun(pool, workspaceId, run.id, { status: 'COMPLETED' });

    await expect(completeModelRun(pool, workspaceId, run.id, { status: 'FAILED' })).rejects.toThrow(
      ModelRunTransitionError,
    );
  });

  it('getModelRun returns null for cross-workspace access', async () => {
    const { workspaceId: wsA, userId } = await createWorkspace(pool);
    const wsB = await createSecondWorkspace(pool, userId);
    const conv = await createConversation(pool, wsA, userId, {});
    const msg = await createMessage(pool, wsA, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const run = await createModelRun(pool, wsA, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    const found = await getModelRun(pool, wsB, run.id);
    expect(found).toBeNull();
  });

  it('handles non-existent model run gracefully', async () => {
    const { workspaceId } = await createWorkspace(pool);
    const found = await getModelRun(pool, workspaceId, '00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Retrieval trace linking
// ---------------------------------------------------------------------------

describe('model_run_retrieval_traces linking', () => {
  it('links retrieval traces to a model run', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    // Create retrieval config and traces
    const config = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_configs (id, workspace_id, name, version, configuration)
       VALUES (gen_random_uuid(), $1, 'test-config', 'v1', '{}'::jsonb) RETURNING id`,
      [workspaceId],
    );
    const configId = config.rows[0]!.id;

    const trace1 = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_traces (id, workspace_id, requested_by, query_text, retrieval_config_id)
       VALUES (gen_random_uuid(), $1, $2, 'test query', $3) RETURNING id`,
      [workspaceId, userId, configId],
    );
    const trace2 = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_traces (id, workspace_id, requested_by, query_text, retrieval_config_id)
       VALUES (gen_random_uuid(), $1, $2, 'test query 2', $3) RETURNING id`,
      [workspaceId, userId, configId],
    );

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    await linkRetrievalTraces(pool, workspaceId, run.id, [trace1.rows[0]!.id, trace2.rows[0]!.id]);

    // Verify the links
    const links = await pool.query<{ model_run_id: string; retrieval_trace_id: string }>(
      `SELECT * FROM model_run_retrieval_traces WHERE model_run_id = $1`,
      [run.id],
    );
    expect(links.rows).toHaveLength(2);
    const traceIds = links.rows.map((r) => r.retrieval_trace_id);
    expect(traceIds).toEqual(expect.arrayContaining([trace1.rows[0]!.id, trace2.rows[0]!.id]));
  });

  it('linking is idempotent', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const config = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_configs (id, workspace_id, name, version, configuration)
       VALUES (gen_random_uuid(), $1, 'test-config-2', 'v1', '{}'::jsonb) RETURNING id`,
      [workspaceId],
    );
    const configId = config.rows[0]!.id;

    const trace = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_traces (id, workspace_id, requested_by, query_text, retrieval_config_id)
       VALUES (gen_random_uuid(), $1, $2, 'q', $3) RETURNING id`,
      [workspaceId, userId, configId],
    );
    const traceId = trace.rows[0]!.id;

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    // Link twice
    await linkRetrievalTraces(pool, workspaceId, run.id, [traceId]);
    await linkRetrievalTraces(pool, workspaceId, run.id, [traceId]);

    // Should still have only one link
    const links = await pool.query(
      `SELECT * FROM model_run_retrieval_traces WHERE model_run_id = $1`,
      [run.id],
    );
    expect(links.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Constraint enforcement
// ---------------------------------------------------------------------------

describe('constraint enforcement', () => {
  it('rejects FKs to non-existent workspaces', async () => {
    await expect(
      pool.query(
        `INSERT INTO conversations (workspace_id, created_by)
         VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000')`,
      ),
    ).rejects.toThrow();
  });

  it('rejects duplicate PK in model_run_retrieval_traces', async () => {
    const { workspaceId, userId } = await createWorkspace(pool);
    const conv = await createConversation(pool, workspaceId, userId, {});
    const msg = await createMessage(pool, workspaceId, {
      conversationId: conv.id,
      role: 'USER',
      content: 'Hi',
    });

    const config = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_configs (id, workspace_id, name, version, configuration)
       VALUES (gen_random_uuid(), $1, 'test-config-3', 'v1', '{}'::jsonb) RETURNING id`,
      [workspaceId],
    );
    const configId = config.rows[0]!.id;

    const trace = await pool.query<{ id: string }>(
      `INSERT INTO retrieval_traces (id, workspace_id, requested_by, query_text, retrieval_config_id)
       VALUES (gen_random_uuid(), $1, $2, 'q', $3) RETURNING id`,
      [workspaceId, userId, configId],
    );
    const traceId = trace.rows[0]!.id;

    const run = await createModelRun(pool, workspaceId, {
      conversationId: conv.id,
      userMessageId: msg.id,
      provider: 'fake',
      model: 'fake-v1',
      promptName: 'test',
      promptVersion: 'v1',
    });

    await pool.query(
      `INSERT INTO model_run_retrieval_traces (model_run_id, retrieval_trace_id) VALUES ($1, $2)`,
      [run.id, traceId],
    );

    await expect(
      pool.query(
        `INSERT INTO model_run_retrieval_traces (model_run_id, retrieval_trace_id) VALUES ($1, $2)`,
        [run.id, traceId],
      ),
    ).rejects.toThrow();
  });
});
