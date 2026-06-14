// ---------------------------------------------------------------------------
// Security: P3-T08 cross-tenant insert regression test (P3-T10)
// ---------------------------------------------------------------------------
// Per the P3-T08 review (`planning/reviews/P3-T08.md`):
//   PRE_EXISTING: `apps/api/src/routes/feedback.ts:166-181` allows a user
//   in workspace A to submit feedback for a message UUID in workspace B.
//   The RLS policy on `feedback.message_id` does not catch the
//   cross-workspace insert because the message is referenced by UUID
//   only — the FK does not enforce workspace_id alignment.
//
// This test DOCUMENTS the gap by asserting the current behavior. The
// fix is scheduled for P4 (cross-tenant message lookup before insert).
//
// IMPORTANT: This is a security REGRESSION TEST, not a fix. It records
// the gap so that:
//   1. Future changes that introduce the same gap are caught.
//   2. Future changes that close the gap can update the assertions.
//
// Current state: submitFeedback does NOT verify the message's
// workspace_id matches the supplied workspaceId. The insert succeeds
// even when the message belongs to a different workspace. This is a
// known P4 follow-up.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { submitFeedback } from '@pia/ai';
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
    'documents the PRE_EXISTING gap: submitFeedback inserts feedback for a ' +
      'message in another workspace (FIX scheduled for P4)',
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

      // A user from ALPHA attempts to submit feedback referencing a message
      // in the OTHER workspace. The workspaceId passed is alpha; the
      // messageId belongs to other. As of P3-T08, this insert SUCCEEDS
      // because the service does not check message workspace alignment.
      // The fix is scheduled for P4.
      const result = await submitFeedback(pool, {
        workspaceId: fixtures.workspaceId,
        submittedBy: fixtures.userId,
        messageId: otherMessageId,
        category: 'POSITIVE',
      });

      // The insert succeeded — this IS the gap.
      expect(result.row.id).toBeDefined();
      expect(result.row.workspaceId).toBe(fixtures.workspaceId);
      // But the message it references belongs to the other workspace.
      // The RLS policy on `messages` is not consulted because the FK is
      // checked by ID, not by workspace.
      const messageWorkspace = await pool.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM messages WHERE id = $1`,
        [otherMessageId],
      );
      expect(messageWorkspace.rows[0]?.workspace_id).toBe(fixtures.otherWorkspaceId);

      // When the P4 fix lands, this test should be updated to assert
      // that submitFeedback THROWS with a "message not found" or
      // "cross-workspace" error.
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
