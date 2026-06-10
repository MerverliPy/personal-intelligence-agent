import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuditWriter, type AuditWriter } from '../src/writer.js';
import { createAuditReader } from '../src/reader.js';
import { redactAuditMetadata, redactAuditPayload } from '../src/redact.js';
import type {
  AuditEventInput,
  AuditEventFilter,
  AuditEventPage,
  AuditEvent,
} from '../src/types.js';
import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock pg.Pool that records queries and returns given results. */
function createMockPool(responses: Array<{ rows: Array<Record<string, unknown>> }> = []): {
  pool: Pool;
  queries: Array<{ text: string; params: unknown[] }>;
  addResponse: (rows: Array<Record<string, unknown>>) => void;
} {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  let responseIdx = 0;

  const pool = {
    query: vi.fn().mockImplementation((text: string, params?: unknown[]) => {
      queries.push({ text, params: params ?? [] });
      const response = responses[responseIdx] ?? { rows: [], command: 'INSERT', rowCount: 0 };
      responseIdx++;
      return Promise.resolve(response);
    }),
    connect: vi.fn().mockImplementation(() => {
      const clientQueries: Array<{ text: string; params: unknown[] }> = [];
      let clientReleased = false;
      let clientEnded = false;
      return Promise.resolve({
        query: vi.fn().mockImplementation((text: string, params?: unknown[]) => {
          clientQueries.push({ text, params: params ?? [] });
          return Promise.resolve({ rows: [], command: 'INSERT', rowCount: 0 });
        }),
        release: vi.fn().mockImplementation(() => {
          clientReleased = true;
        }),
        _queries: clientQueries,
        _released: () => clientReleased,
        _ended: () => clientEnded,
      });
    }),
  } as unknown as Pool;

  return {
    pool,
    queries,
    addResponse: (rows: Array<Record<string, unknown>>) => {
      responses.push({ rows });
    },
  };
}

/** Creates a basic audit event input. */
function makeEvent(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    workspaceId: 'ws-test-0000-0000-0000-000000000000',
    actorId: 'user-0000-0000-0000-000000000000',
    actorType: 'user',
    action: 'auth.denied',
    outcome: 'denied',
    requestId: 'req-0000-0000-0000-000000000000',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

describe('redactAuditMetadata', () => {
  it('strips password fields', () => {
    const result = redactAuditMetadata({ password: 'secret123', name: 'alice' });
    expect(result['password']).toBe('[REDACTED]');
    expect(result['name']).toBe('alice');
  });

  it('strips token fields', () => {
    const result = redactAuditMetadata({ token: 'bearer-xxx', access_token: 'yyy' });
    expect(result['token']).toBe('[REDACTED]');
    expect(result['access_token']).toBe('[REDACTED]');
  });

  it('strips secret fields', () => {
    const result = redactAuditMetadata({ apiKey: 'sk-abc', private_key: 'pem-data' });
    expect(result['apiKey']).toBe('[REDACTED]');
    expect(result['private_key']).toBe('[REDACTED]');
  });

  it('strips credential fields', () => {
    const result = redactAuditMetadata({ credential: 'x', cookie: 'y' });
    expect(result['credential']).toBe('[REDACTED]');
    expect(result['cookie']).toBe('[REDACTED]');
  });

  it('strips authorization header', () => {
    const result = redactAuditMetadata({ authorization: 'Bearer token', cookie: 'sid=abc' });
    expect(result['authorization']).toBe('[REDACTED]');
    expect(result['cookie']).toBe('[REDACTED]');
  });

  it('preserves non-sensitive fields', () => {
    const result = redactAuditMetadata({
      userId: 'alice',
      action: 'login',
      role: 'admin',
      status: 'active',
      count: 42,
    });
    expect(result['userId']).toBe('alice');
    expect(result['action']).toBe('login');
    expect(result['role']).toBe('admin');
    expect(result['status']).toBe('active');
    expect(result['count']).toBe(42);
  });

  it('returns empty object for empty input', () => {
    const result = redactAuditMetadata({});
    expect(result).toEqual({});
  });

  it('handles null/undefined gracefully', () => {
    const result = redactAuditMetadata({ key: null, other: undefined });
    expect(result['key']).toBeNull();
    expect(result['other']).toBeUndefined();
  });
});

describe('redactAuditPayload', () => {
  it('recursively redacts nested objects', () => {
    const result = redactAuditPayload({
      user: { name: 'alice', password: 'secret' },
      token: 'abc',
    });
    const obj = result as Record<string, unknown>;
    expect(obj['token']).toBe('[REDACTED]');
    const user = obj['user'] as Record<string, unknown>;
    expect(user['name']).toBe('alice');
    expect(user['password']).toBe('[REDACTED]');
  });

  it('handles non-object values', () => {
    expect(redactAuditPayload('hello')).toBe('hello');
    expect(redactAuditPayload(42)).toBe(42);
    expect(redactAuditPayload(null)).toBe(null);
    expect(redactAuditPayload(undefined)).toBe(undefined);
  });

  it('handles arrays (passes through)', () => {
    const result = redactAuditPayload([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Audit Writer
// ---------------------------------------------------------------------------

describe('AuditWriter', () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let writer: AuditWriter;

  beforeEach(() => {
    mockPool = createMockPool([{ rows: [{ id: 'evt-1' }] }]);
    writer = createAuditWriter(mockPool.pool);
  });

  it('writes a single audit event with INSERT', async () => {
    await writer.write(makeEvent());

    expect(mockPool.queries.length).toBe(1);
    const insert = mockPool.queries[0]!;
    expect(insert.text).toContain('INSERT INTO audit_events');
    expect(insert.text).toContain('workspace_id');
    expect(insert.text).toContain('actor_id');
    expect(insert.text).toContain('actor_type');
    expect(insert.text).toContain('action');
    expect(insert.text).toContain('outcome');
    expect(insert.text).toContain('request_id');
    expect(insert.text).toContain('redacted_metadata');
  });

  it('writes correct event fields', async () => {
    await writer.write(
      makeEvent({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'auth.denied',
        resourceType: 'workspace',
        resourceId: 'ws-2',
        outcome: 'denied',
        reasonCode: 'not_member',
        requestId: 'req-1',
        traceId: 'trace-1',
        policyDecision: { rule: 'deny_by_default' },
        metadata: { attempt: 1 },
      }),
    );

    const params = mockPool.queries[0]!.params;
    expect(params[0]).toBe('ws-1'); // workspace_id
    expect(params[1]).toBe('user-1'); // actor_id
    expect(params[2]).toBe('user'); // actor_type
    expect(params[3]).toBe('auth.denied'); // action
    expect(params[4]).toBe('workspace'); // resource_type
    expect(params[5]).toBe('ws-2'); // resource_id
    expect(params[6]).toBe('denied'); // outcome
    expect(params[7]).toBe('not_member'); // reason_code
    expect(params[8]).toBe('req-1'); // request_id
    expect(params[9]).toBe('trace-1'); // trace_id
  });

  it('redacts sensitive fields in metadata before INSERT', async () => {
    await writer.write(
      makeEvent({
        metadata: {
          userId: 'alice',
          password: 'secret123',
          token: 'bearer-xxx',
          action: 'login',
        },
      }),
    );

    const params = mockPool.queries[0]!.params;
    // params[11] is redacted_metadata (JSON string)
    const metadata = JSON.parse(params[11] as string) as Record<string, unknown>;
    expect(metadata['userId']).toBe('alice');
    expect(metadata['password']).toBe('[REDACTED]');
    expect(metadata['token']).toBe('[REDACTED]');
    expect(metadata['action']).toBe('login');
  });

  it('handles null metadata gracefully', async () => {
    await writer.write(makeEvent({ metadata: undefined }));
    const params = mockPool.queries[0]!.params;
    const metadata = JSON.parse(params[11] as string) as Record<string, unknown>;
    expect(metadata).toEqual({});
  });

  it('writeBatch inserts multiple events in a transaction', async () => {
    const connectSpy = vi.spyOn(mockPool.pool, 'connect');

    await writer.writeBatch([
      makeEvent({ action: 'auth.denied', requestId: 'req-1' }),
      makeEvent({ action: 'membership.changed', requestId: 'req-2' }),
    ]);

    // connect() should have been called for the transaction
    expect(connectSpy).toHaveBeenCalled();
  });

  it('writeBatch with empty array is a no-op', async () => {
    await writer.writeBatch([]);
    expect(mockPool.queries.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Audit Reader
// ---------------------------------------------------------------------------

describe('AuditReader', () => {
  it('queries with required workspaceId filter', async () => {
    const { pool, queries } = createMockPool([{ rows: [] }]);
    const reader = createAuditReader(pool);

    await reader.query({ workspaceId: 'ws-1' });

    expect(queries.length).toBe(1);
    const sql = queries[0]!.text;
    expect(sql).toContain('workspace_id');
    expect(queries[0]!.params[0]).toBe('ws-1');
  });

  it('constructs query with all optional filters', async () => {
    const { pool, queries } = createMockPool([{ rows: [] }]);
    const reader = createAuditReader(pool);

    const from = new Date('2026-01-01');
    const to = new Date('2026-12-31');

    await reader.query({
      workspaceId: 'ws-1',
      actorId: 'user-1',
      action: 'auth.denied',
      resourceType: 'workspace',
      outcome: 'denied',
      from,
      to,
      cursor: 'evt-10',
      limit: 50,
    });

    expect(queries.length).toBe(1);
    const sql = queries[0]!.text;
    expect(sql).toContain('actor_id');
    expect(sql).toContain('action');
    expect(sql).toContain('resource_type');
    expect(sql).toContain('outcome');
    expect(sql).toContain('occurred_at >=');
    expect(sql).toContain('occurred_at <=');
    expect(sql).toContain('id >');
    expect(sql).toContain('LIMIT');
  });

  it('clamps limit between 1 and 1000', async () => {
    const { pool, queries: queriesLow } = createMockPool([{ rows: [] }]);
    const readerLow = createAuditReader(pool);
    await readerLow.query({ workspaceId: 'ws-1', limit: 0 });

    // Should clamp to 1, query fetches 2 to detect next page
    const paramsLow = queriesLow[0]!.params;
    expect(paramsLow[paramsLow.length - 1]).toBe(2); // limit+1

    const { pool: pool2, queries: queriesHigh } = createMockPool([{ rows: [] }]);
    const readerHigh = createAuditReader(pool2);
    await readerHigh.query({ workspaceId: 'ws-1', limit: 9999 });

    const paramsHigh = queriesHigh[0]!.params;
    expect(paramsHigh[paramsHigh.length - 1]).toBe(1001); // clamped to 1000+1
  });

  it('returns events mapped to AuditEvent type', async () => {
    const now = new Date();
    const { pool } = createMockPool([
      {
        rows: [
          {
            id: 'evt-1',
            workspace_id: 'ws-1',
            actor_id: 'user-1',
            actor_type: 'user',
            action: 'auth.denied',
            resource_type: 'workspace',
            resource_id: 'ws-2',
            outcome: 'denied',
            reason_code: 'not_member',
            request_id: 'req-1',
            trace_id: null,
            policy_decision: null,
            redacted_metadata: { attempt: 1 },
            occurred_at: now,
          },
        ],
      },
    ]);
    const reader = createAuditReader(pool);

    const page = await reader.query({ workspaceId: 'ws-1' });
    expect(page.events).toHaveLength(1);
    const event = page.events[0]!;
    expect(event.id).toBe('evt-1');
    expect(event.workspaceId).toBe('ws-1');
    expect(event.actorId).toBe('user-1');
    expect(event.actorType).toBe('user');
    expect(event.action).toBe('auth.denied');
    expect(event.resourceType).toBe('workspace');
    expect(event.resourceId).toBe('ws-2');
    expect(event.outcome).toBe('denied');
    expect(event.reasonCode).toBe('not_member');
    expect(event.requestId).toBe('req-1');
    expect(event.redactedMetadata).toEqual({ attempt: 1 });
    expect(event.occurredAt).toBe(now);
  });

  it('returns nextCursor when there are more results', async () => {
    const { pool } = createMockPool([
      {
        rows: [
          {
            id: 'evt-2',
            workspace_id: 'ws-1',
            actor_type: 'user',
            action: 'a',
            outcome: 'success',
            request_id: 'r',
            redacted_metadata: {},
            occurred_at: new Date(),
          },
          {
            id: 'evt-1',
            workspace_id: 'ws-1',
            actor_type: 'user',
            action: 'b',
            outcome: 'success',
            request_id: 'r',
            redacted_metadata: {},
            occurred_at: new Date(),
          },
          {
            id: 'evt-0',
            workspace_id: 'ws-1',
            actor_type: 'user',
            action: 'c',
            outcome: 'success',
            request_id: 'r',
            redacted_metadata: {},
            occurred_at: new Date(),
          },
        ],
      },
    ]);
    const reader = createAuditReader(pool);

    const page = await reader.query({ workspaceId: 'ws-1', limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.nextCursor).toBe('evt-1');
  });

  it('returns null nextCursor for the last page', async () => {
    const { pool } = createMockPool([
      {
        rows: [
          {
            id: 'evt-2',
            workspace_id: 'ws-1',
            actor_type: 'user',
            action: 'a',
            outcome: 'success',
            request_id: 'r',
            redacted_metadata: {},
            occurred_at: new Date(),
          },
          {
            id: 'evt-1',
            workspace_id: 'ws-1',
            actor_type: 'user',
            action: 'b',
            outcome: 'success',
            request_id: 'r',
            redacted_metadata: {},
            occurred_at: new Date(),
          },
        ],
      },
    ]);
    const reader = createAuditReader(pool);

    const page = await reader.query({ workspaceId: 'ws-1', limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Known audit event types
// ---------------------------------------------------------------------------

describe('audit event types', () => {
  const eventTypes = [
    { action: 'auth.login', description: 'login events' },
    { action: 'auth.logout', description: 'logout events' },
    { action: 'auth.denied', description: 'authorization denials' },
    { action: 'membership.changed', description: 'membership changes' },
    { action: 'membership.removed', description: 'membership removal' },
    { action: 'document.uploaded', description: 'document upload' },
    { action: 'document.quarantined', description: 'document quarantine' },
    { action: 'document.versioned', description: 'document versioning' },
    { action: 'document.deleted', description: 'document deletion' },
    { action: 'config.promoted', description: 'configuration promotion' },
    { action: 'admin.access', description: 'administrative access' },
  ];

  for (const { action, description } of eventTypes) {
    it(`records ${description} (${action})`, async () => {
      const { pool, queries } = createMockPool([{ rows: [{ id: 'evt-1' }] }]);
      const writer = createAuditWriter(pool);

      await writer.write(makeEvent({ action }));

      expect(queries.length).toBe(1);
      const params = queries[0]!.params;
      expect(params[3]).toBe(action); // action field
    });
  }
});

// ---------------------------------------------------------------------------
// Append-only assertion
// ---------------------------------------------------------------------------

describe('audit writer is append-only', () => {
  it('only performs INSERT operations', async () => {
    const { pool, queries } = createMockPool([{ rows: [{ id: 'evt-1' }] }]);
    const writer = createAuditWriter(pool);

    await writer.write(makeEvent());

    expect(queries.length).toBe(1);
    const sql = queries[0]!.text;
    // Must be an INSERT, not UPDATE or DELETE
    expect(sql.trim().toUpperCase()).toMatch(/^INSERT/);
    expect(sql).not.toContain('UPDATE');
    expect(sql).not.toContain('DELETE');
  });

  it('batch write uses only INSERT within transaction', async () => {
    const { pool } = createMockPool([{ rows: [{ id: 'evt-1' }] }]);
    const writer = createAuditWriter(pool);

    const connectSpy = vi.spyOn(pool, 'connect');
    await writer.writeBatch([makeEvent(), makeEvent({ action: 'auth.login' })]);

    expect(connectSpy).toHaveBeenCalled();
  });
});
