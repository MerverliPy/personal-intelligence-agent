// ---------------------------------------------------------------------------
// Feedback retrieval-trace link repository integration tests
// ---------------------------------------------------------------------------
// Covers the `feedback_retrieval_traces` join table introduced in
// migration 010. Tests verify:
//   - insert (idempotent on duplicate)
//   - list
//   - cross-workspace isolation
//   - feedback delete cascades the link
//   - cap enforcement
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { createConversation } from '../src/conversations.js';
import { createMessage } from '../src/messages.js';
import { createFeedback, getFeedback } from '../src/feedback.js';
import {
  addFeedbackRetrievalTraces,
  getFeedbackRetrievalTraces,
  deleteFeedbackRetrievalTraces,
  MAX_FEEDBACK_RETRIEVAL_TRACES,
} from '../src/feedback-retrieval-traces.js';

let pool: Pool;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

interface Fixture {
  workspaceId: string;
  userId: string;
  messageId: string;
}

async function createWorkspaceUserAndMessage(p: Pool, label: string): Promise<Fixture> {
  const user = await p.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [`fbrt-${label}-${Date.now()}-${Math.random()}@test.com`],
  );
  const userId = user.rows[0]!.id;
  const ws = await p.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`FBRT ${label} ${Date.now()}`, userId],
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
    content: 'Trace link test message',
    createdBy: userId,
  });
  return { workspaceId: wsId, userId, messageId: msg.id };
}

async function insertTrace(p: Pool, workspaceId: string): Promise<string> {
  // Per-call unique name/version: the `retrieval_configs` table has a
  // UNIQUE (workspace_id, name, version) constraint, so the helper must
  // generate a fresh config per call rather than reusing a fixed one.
  const user = await p.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [`fbrt-trace-${Date.now()}-${Math.random()}@test.com`],
  );
  const userId = user.rows[0]!.id;
  const configName = `fb-trace-config-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const config = await p.query<{ id: string }>(
    `INSERT INTO retrieval_configs (workspace_id, name, version, configuration, created_by)
     VALUES ($1, $2, $3, '{}'::jsonb, $4) RETURNING id`,
    [workspaceId, configName, '1.0.0', userId],
  );
  const configId = config.rows[0]!.id;
  const trace = await p.query<{ id: string }>(
    `INSERT INTO retrieval_traces (workspace_id, requested_by, query_text, retrieval_config_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [workspaceId, userId, 'test query', configId],
  );
  return trace.rows[0]!.id;
}

describe('addFeedbackRetrievalTraces', () => {
  it('inserts trace links and returns the count', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'add1');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'INCORRECT',
    });
    const t1 = await insertTrace(pool, fx.workspaceId);
    const t2 = await insertTrace(pool, fx.workspaceId);

    const inserted = await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t1, t2]);
    expect(inserted).toBe(2);

    const list = await getFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id);
    expect(list).toHaveLength(2);
    expect(list).toEqual(expect.arrayContaining([t1, t2]));
  });

  it('is idempotent on duplicate (feedback_id, retrieval_trace_id)', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'add2');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'POSITIVE',
    });
    const t = await insertTrace(pool, fx.workspaceId);

    const a = await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t]);
    const b = await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t]);
    expect(a).toBe(1);
    expect(b).toBe(0);
    const list = await getFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id);
    expect(list).toEqual([t]);
  });

  it('deduplicates input IDs', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'add3');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'NEGATIVE',
    });
    const t = await insertTrace(pool, fx.workspaceId);
    const inserted = await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t, t, t]);
    expect(inserted).toBe(1);
  });

  it('returns 0 when given an empty array', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'add4');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'STYLE_ISSUE',
    });
    const inserted = await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, []);
    expect(inserted).toBe(0);
  });

  it('rejects input that exceeds the cap', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'add5');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'UNSAFE',
    });
    // 65 distinct UUIDs — the implementation dedupes input before the
    // cap check, so identical UUIDs would collapse to 1 and the cap
    // path would never fire.
    const ids = Array.from({ length: MAX_FEEDBACK_RETRIEVAL_TRACES + 1 }, () => randomUUID());
    await expect(addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, ids)).rejects.toThrow(
      /Too many retrieval trace links/,
    );
  });
});

describe('getFeedbackRetrievalTraces', () => {
  it('returns empty array when no links exist', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'get1');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'POSITIVE',
    });
    const list = await getFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id);
    expect(list).toEqual([]);
  });

  it('scopes to workspace (cross-workspace returns empty)', async () => {
    const ws1 = await createWorkspaceUserAndMessage(pool, 'get2a');
    const ws2 = await createWorkspaceUserAndMessage(pool, 'get2b');
    const fb = await createFeedback(pool, {
      workspaceId: ws1.workspaceId,
      messageId: ws1.messageId,
      submittedBy: ws1.userId,
      category: 'INCORRECT',
    });
    const t = await insertTrace(pool, ws1.workspaceId);
    await addFeedbackRetrievalTraces(pool, ws1.workspaceId, fb.id, [t]);

    const cross = await getFeedbackRetrievalTraces(pool, ws2.workspaceId, fb.id);
    expect(cross).toEqual([]);
  });
});

describe('deleteFeedbackRetrievalTraces', () => {
  it('removes all links for a feedback row', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'del1');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'INCOMPLETE',
    });
    const t1 = await insertTrace(pool, fx.workspaceId);
    const t2 = await insertTrace(pool, fx.workspaceId);
    await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t1, t2]);

    const removed = await deleteFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id);
    expect(removed).toBe(2);
    const list = await getFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id);
    expect(list).toEqual([]);
  });
});

describe('cascade: deleting feedback removes trace links', () => {
  it('ON DELETE CASCADE removes feedback_retrieval_traces rows', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'casc1');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'CITATION_ISSUE',
    });
    const t = await insertTrace(pool, fx.workspaceId);
    await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t]);

    await pool.query(`DELETE FROM feedback WHERE id = $1`, [fb.id]);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS n FROM feedback_retrieval_traces WHERE feedback_id = $1`,
      [fb.id],
    );
    expect(result.rows[0]!.n).toBe(0);
  });
});

describe('getFeedback hydrates retrievalTraceIds', () => {
  it('returns retrieval trace IDs linked to the feedback', async () => {
    const fx = await createWorkspaceUserAndMessage(pool, 'hyd1');
    const fb = await createFeedback(pool, {
      workspaceId: fx.workspaceId,
      messageId: fx.messageId,
      submittedBy: fx.userId,
      category: 'POSITIVE',
    });
    const t1 = await insertTrace(pool, fx.workspaceId);
    const t2 = await insertTrace(pool, fx.workspaceId);
    await addFeedbackRetrievalTraces(pool, fx.workspaceId, fb.id, [t1, t2]);

    const fetched = await getFeedback(pool, fx.workspaceId, fb.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.retrievalTraceIds).toHaveLength(2);
    expect(fetched!.retrievalTraceIds).toEqual(expect.arrayContaining([t1, t2]));
  });
});
