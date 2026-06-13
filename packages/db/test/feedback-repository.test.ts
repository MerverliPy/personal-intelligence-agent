// ---------------------------------------------------------------------------
// Feedback repository integration tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { createConversation } from '../src/conversations.js';
import { createMessage } from '../src/messages.js';
import {
  createFeedback,
  getFeedbackForMessage,
  getFeedback,
  type FeedbackRow,
} from '../src/feedback.js';

let pool: Pool;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

async function createWorkspaceUserAndMessage(
  p: Pool,
): Promise<{ workspaceId: string; userId: string; messageId: string }> {
  const user = await p.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [`fb-test-${Date.now()}@test.com`],
  );
  const userId = user.rows[0]!.id;
  const ws = await p.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`Feedback Test WS ${Date.now()}`, userId],
  );
  const wsId = ws.rows[0]!.id;
  await p.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [wsId, userId],
  );
  const conv = await createConversation(p, wsId, userId, { mode: 'ASK' });
  const msg = await createMessage(p, wsId, {
    conversationId: conv.id,
    role: 'USER',
    content: 'Test message for feedback',
    createdBy: userId,
  });
  return { workspaceId: wsId, userId, messageId: msg.id };
}

describe('createFeedback', () => {
  it('creates feedback with required fields only', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const fb = await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'POSITIVE',
    });

    expect(fb.id).toBeDefined();
    expect(fb.workspaceId).toBe(workspaceId);
    expect(fb.messageId).toBe(messageId);
    expect(fb.submittedBy).toBe(userId);
    expect(fb.category).toBe('POSITIVE');
    expect(fb.correction).toBeNull();
    expect(fb.notes).toBeNull();
    expect(fb.modelRunId).toBeNull();
  });

  it('creates feedback with all fields including failure classification', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const fb = await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'INCORRECT',
      correction: 'The correct answer is 42.',
      notes: 'Hallucination detected.',
      suggestedFailureClass: 'reasoning',
      classificationConfidence: 0.85,
    });

    expect(fb.category).toBe('INCORRECT');
    expect(fb.correction).toBe('The correct answer is 42.');
    expect(fb.notes).toBe('Hallucination detected.');
    expect(fb.suggestedFailureClass).toBe('reasoning');
    expect(fb.classificationConfidence).toBe(0.85);
  });

  it('creates feedback linked to a model run', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const runRes = await pool.query<{ id: string }>(
      `INSERT INTO model_runs (workspace_id, conversation_id, user_message_id, provider, model, prompt_name, prompt_version)
       VALUES ($1, (SELECT conversation_id FROM messages WHERE id = $2), $2, 'fake', 'fake-v1', 'test', '1.0.0')
       RETURNING id`,
      [workspaceId, messageId],
    );
    const runId = runRes.rows[0]!.id;

    const fb = await createFeedback(pool, {
      workspaceId,
      messageId,
      modelRunId: runId,
      submittedBy: userId,
      category: 'CITATION_ISSUE',
    });

    expect(fb.modelRunId).toBe(runId);
    expect(fb.category).toBe('CITATION_ISSUE');
  });

  it('accepts the FREE_TEXT category (FR-FBK-001)', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const fb = await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'FREE_TEXT',
      correction: 'The answer should reference the Q3 financial report.',
    });

    expect(fb.category).toBe('FREE_TEXT');
    expect(fb.correction).toContain('Q3 financial report');
  });
});

describe('getFeedbackForMessage', () => {
  it('returns all feedback for a message ordered by newest first', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'NEGATIVE',
    });
    await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'INCORRECT',
      correction: 'Try again.',
    });

    const results = await getFeedbackForMessage(pool, workspaceId, messageId);
    expect(results).toHaveLength(2);
    expect(results[0]!.category).toBe('INCORRECT');
    expect(results[1]!.category).toBe('NEGATIVE');
  });

  it('returns empty array when no feedback exists', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const results = await getFeedbackForMessage(pool, workspaceId, messageId);
    expect(results).toHaveLength(0);
  });

  it('scopes feedback to workspace', async () => {
    const ws1 = await createWorkspaceUserAndMessage(pool);
    const ws2 = await createWorkspaceUserAndMessage(pool);

    await createFeedback(pool, {
      workspaceId: ws1.workspaceId,
      messageId: ws1.messageId,
      submittedBy: ws1.userId,
      category: 'POSITIVE',
    });

    const results = await getFeedbackForMessage(pool, ws2.workspaceId, ws1.messageId);
    expect(results).toHaveLength(0);
  });
});

describe('getFeedback', () => {
  it('retrieves a single feedback by id scoped to workspace', async () => {
    const { workspaceId, userId, messageId } = await createWorkspaceUserAndMessage(pool);

    const created = await createFeedback(pool, {
      workspaceId,
      messageId,
      submittedBy: userId,
      category: 'UNSAFE',
    });

    const found = await getFeedback(pool, workspaceId, created.id);
    expect(found).not.toBeNull();
    expect(found!.category).toBe('UNSAFE');
  });

  it('returns null for non-existent feedback', async () => {
    const { workspaceId } = await createWorkspaceUserAndMessage(pool);

    const found = await getFeedback(pool, workspaceId, '00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('returns null when feedback belongs to different workspace', async () => {
    const ws1 = await createWorkspaceUserAndMessage(pool);
    const ws2 = await createWorkspaceUserAndMessage(pool);

    const created = await createFeedback(pool, {
      workspaceId: ws1.workspaceId,
      messageId: ws1.messageId,
      submittedBy: ws1.userId,
      category: 'STYLE_ISSUE',
    });

    const found = await getFeedback(pool, ws2.workspaceId, created.id);
    expect(found).toBeNull();
  });
});
