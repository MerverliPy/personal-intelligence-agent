// ---------------------------------------------------------------------------
// Security: P3-T08 cross-tenant insert regression test (P3-T10) — FIXED (P4 pre-flight, AUD-P3-101)
// ---------------------------------------------------------------------------
// Originally documented a PRE_EXISTING gap at the API route layer
// (cross-workspace `messageId` insertion). The fix is now in
// `packages/ai/src/feedback/service.ts` (AUD-P3-101): the service
// performs a workspace-alignment check via `getMessage` BEFORE
// inserting the feedback row, and throws `MessageNotFoundError` if
// the message does not exist in the supplied workspace.
//
// This test now ASSERTS the fix rather than documenting the gap. The
// service-layer check is defense-in-depth on top of the route-layer
// `requireWorkspaceContext` check at `apps/api/src/routes/feedback.ts`.
// If a future change re-introduces the gap, this test will fail.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { submitFeedback, MessageNotFoundError } from '@pia/ai';
import {
  setupSecurityDatabase,
  teardownSecurityDatabase,
  seedSecurityFixtures,
  isDatabaseAvailable,
  type SecurityFixtureRegistry,
} from './helpers/setupSecurity.js';

let pool: Pool | undefined;
let fixtures: SecurityFixtureRegistry | undefined;
let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    console.warn(
      'PostgreSQL unavailable — P3-T08 cross-tenant insert regression test will be skipped.',
    );
    return;
  }
  pool = await setupSecurityDatabase();
  fixtures = await seedSecurityFixtures(pool);
}, 60_000);

afterAll(async () => {
  if (pool) {
    await teardownSecurityDatabase();
  }
}, 30_000);

describe('P3-T08 cross-tenant insert regression (P3-T10 security)', () => {
  it(
    'rejects cross-tenant messageId with MessageNotFoundError (AUD-P3-101 fix)',
    async () => {
      if (!dbAvailable) return;
      if (!pool || !fixtures) throw new Error('Setup did not complete');

      // Create a message in the OTHER workspace
      const convRes = await pool.query<{ id: string }>(
        `INSERT INTO conversations (id, workspace_id, project_id, title, mode, sensitivity, created_by)
         VALUES (gen_random_uuid(), $1, NULL, 'other conv', 'ASK', 'INTERNAL', $2)
         RETURNING id`,
        [fixtures.otherWorkspaceId, fixtures.otherUserId],
      );
      const otherConvId = convRes.rows[0]!.id;

      const msgRes = await pool.query<{ id: string }>(
        `INSERT INTO messages (id, workspace_id, conversation_id, role, content, created_by)
         VALUES (gen_random_uuid(), $1, $2, 'USER', 'foreign message', $3)
         RETURNING id`,
        [fixtures.otherWorkspaceId, otherConvId, fixtures.otherUserId],
      );
      const otherMessageId = msgRes.rows[0]!.id;

      // A user from ALPHA attempts to submit feedback referencing a
      // message in the OTHER workspace. The workspaceId passed is
      // alpha; the messageId belongs to other. The service-layer
      // check (AUD-P3-101) must throw MessageNotFoundError.
      await expect(
        submitFeedback(pool, {
          workspaceId: fixtures.workspaceId,
          submittedBy: fixtures.userId,
          messageId: otherMessageId,
          category: 'POSITIVE',
        }),
      ).rejects.toBeInstanceOf(MessageNotFoundError);

      // Verify no feedback row landed in alpha for the foreign message.
      const crossRows = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM feedback
         WHERE workspace_id = $1 AND message_id = $2`,
        [fixtures.workspaceId, otherMessageId],
      );
      expect(Number(crossRows.rows[0]?.count ?? '0')).toBe(0);
    },
  );

  it('submitFeedback accepts a message in the same workspace (sanity check)', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    // Create a message in alpha
    const convRes = await pool.query<{ id: string }>(
      `INSERT INTO conversations (id, workspace_id, project_id, title, mode, sensitivity, created_by)
       VALUES (gen_random_uuid(), $1, NULL, 'alpha conv', 'ASK', 'INTERNAL', $2)
       RETURNING id`,
      [fixtures.workspaceId, fixtures.userId],
    );
    const alphaConvId = convRes.rows[0]!.id;

    const msgRes = await pool.query<{ id: string }>(
      `INSERT INTO messages (id, workspace_id, conversation_id, role, content, created_by)
       VALUES (gen_random_uuid(), $1, $2, 'USER', 'alpha message', $3)
       RETURNING id`,
      [fixtures.workspaceId, alphaConvId, fixtures.userId],
    );
    const alphaMessageId = msgRes.rows[0]!.id;

    // Same workspace — should succeed
    const result = await submitFeedback(pool, {
      workspaceId: fixtures.workspaceId,
      submittedBy: fixtures.userId,
      messageId: alphaMessageId,
      category: 'POSITIVE',
    });
    expect(result.row.id).toBeDefined();
    expect(result.row.category).toBe('POSITIVE');
    expect(result.row.workspaceId).toBe(fixtures.workspaceId);
    expect(result.row.messageId).toBe(alphaMessageId);
  });
});
