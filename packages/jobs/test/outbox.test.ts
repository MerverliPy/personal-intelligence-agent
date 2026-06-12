import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { publishOutboxEvents, publishOutboxEvent } from '../src/outbox.js';
import type { OutboxRecord } from '../src/types.js';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

function requirePool(ctx: { skip: () => void }): asserts pool is Pool {
  if (!pool) ctx.skip();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Executes `fn` inside a database transaction, guaranteeing ROLLBACK on
 * failure so the client is returned to the pool in a clean state.
 */
async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    committed = true;
    return result;
  } finally {
    if (!committed) {
      // Squelch rollback errors — the transaction is already aborted
      await client.query('ROLLBACK').catch(() => {});
    }
    client.release();
  }
}

/** Returns the status of an outbox row by ID. */
async function getStatus(p: Pool, id: string): Promise<string | null> {
  const result = await p.query<{ status: string }>(
    'SELECT status FROM outbox_events WHERE id = $1',
    [id],
  );
  return result.rows[0]?.status ?? null;
}

/** Returns a full outbox row by ID. */
async function getRow(p: Pool, id: string): Promise<OutboxRecord | null> {
  const result = await p.query<OutboxRecord>(
    `SELECT
      id,
      workspace_id AS "workspaceId",
      aggregate_type AS "aggregateType",
      aggregate_id AS "aggregateId",
      event_type AS "eventType",
      schema_version AS "schemaVersion",
      payload,
      status,
      attempt,
      available_at AS "availableAt",
      published_at AS "publishedAt",
      created_at AS "createdAt"
    FROM outbox_events WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Transactional publish
// ---------------------------------------------------------------------------

describe('publishOutboxEvents', () => {
  it('publishes a single event inside a transaction and persists on commit', async (ctx) => {
    requirePool(ctx);
    const record = await withTransaction(pool, async (client) => {
      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'test_aggregate',
            aggregateId: '00000000-0000-0000-0000-000000000001',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: { fileId: 'abc', size: 1024 },
          },
        ],
      });

      expect(records).toHaveLength(1);
      const r = records[0]!;
      expect(r.id).toBeTruthy();
      expect(r.eventType).toBe('document.upload.completed');
      expect(r.status).toBe('PENDING');
      expect(r.attempt).toBe(0);
      expect(r.payload).toEqual({ fileId: 'abc', size: 1024 });
      expect(r.aggregateType).toBe('test_aggregate');
      expect(r.schemaVersion).toBe(1);
      expect(r.publishedAt).toBeNull();

      // Not visible outside the transaction yet
      const outside = await getStatus(pool, r.id);
      expect(outside).toBeNull();

      return r;
    });

    // After commit
    const inside = await getStatus(pool, record.id);
    expect(inside).toBe('PENDING');
  });

  it('rolls back events when the transaction is rolled back', async (ctx) => {
    requirePool(ctx);
    let rowId: string | undefined;

    // Manually manage the transaction so we can explicitly rollback
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'rollback_test',
            aggregateId: '00000000-0000-0000-0000-000000000002',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: { shouldNotPersist: true },
          },
        ],
      });

      rowId = records[0]!.id;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Should not be visible after rollback
    const row = await getRow(pool, rowId!);
    expect(row).toBeNull();
  });

  it('publishes multiple events in one batch', async (ctx) => {
    requirePool(ctx);
    const records = await withTransaction(pool, async (client) => {
      const recs = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'batch_test',
            aggregateId: '00000000-0000-0000-0000-000000000003',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: { n: 1 },
          },
          {
            workspaceId: null,
            aggregateType: 'batch_test',
            aggregateId: '00000000-0000-0000-0000-000000000004',
            eventType: 'document.version.ready',
            schemaVersion: 1,
            payload: { n: 2 },
          },
          {
            workspaceId: null,
            aggregateType: 'batch_test',
            aggregateId: '00000000-0000-0000-0000-000000000005',
            eventType: 'evaluation.run.completed',
            schemaVersion: 1,
            payload: { n: 3 },
          },
        ],
      });

      expect(recs).toHaveLength(3);
      return recs;
    });

    for (const r of records) {
      const row = await getRow(pool, r.id);
      expect(row).toBeTruthy();
      expect(row!.status).toBe('PENDING');
    }
  });

  it('persists workspace-scoped events', async (ctx) => {
    requirePool(ctx);
    const record = await withTransaction(pool, async (client) => {
      // Create a user first
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'jobs-test@example.com') RETURNING id`,
      );
      const userId = userRes.rows[0]!.id;

      const wsRes = await client.query<{ id: string }>(
        `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Jobs Test WS', $1) RETURNING id`,
        [userId],
      );
      const wsId = wsRes.rows[0]!.id;

      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: wsId,
            aggregateType: 'document',
            aggregateId: '00000000-0000-0000-0000-000000000010',
            eventType: 'document.ingestion.requested',
            schemaVersion: 1,
            payload: { documentId: 'doc-1' },
          },
        ],
      });

      return records[0]!;
    });

    const row = await getRow(pool, record.id);
    expect(row!.workspaceId).toBe(record.workspaceId);
  });

  it('stores JSON payload exactly as provided', async (ctx) => {
    requirePool(ctx);
    const complexPayload = {
      nested: { key: 'value', arr: [1, 2, 3] },
      flag: false,
    };

    const record = await withTransaction(pool, async (client) => {
      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'payload_test',
            aggregateId: '00000000-0000-0000-0000-000000000020',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: complexPayload,
          },
        ],
      });
      return records[0]!;
    });

    const row = await getRow(pool, record.id);
    expect(row!.payload).toEqual(complexPayload);
  });

  it('rejects events with unregistered event types', async (ctx) => {
    requirePool(ctx);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await expect(
        publishOutboxEvents({
          client,
          events: [
            {
              workspaceId: null,
              aggregateType: 'bad',
              aggregateId: '00000000-0000-0000-0000-000000000030',
              eventType: 'unknown.event.type' as never,
              schemaVersion: 1,
              payload: {},
            },
          ],
        }),
      ).rejects.toThrow('No schema version registered');
    } finally {
      // Ensure cleanup even if the test assertion fails
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  it('handles custom availableAt timestamps', async (ctx) => {
    requirePool(ctx);
    const future = new Date(Date.now() + 3_600_000); // 1 hour from now

    const record = await withTransaction(pool, async (client) => {
      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'delayed',
            aggregateId: '00000000-0000-0000-0000-000000000040',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: { delayed: true },
            availableAt: future,
          },
        ],
      });
      return records[0]!;
    });

    const row = await getRow(pool, record.id);
    expect(row!.availableAt.getTime()).toBe(future.getTime());
  });

  it('returns empty array for zero events', async (ctx) => {
    requirePool(ctx);
    const records = await withTransaction(pool, async (client) => {
      const recs = await publishOutboxEvents({ client, events: [] });
      expect(recs).toEqual([]);
      return recs;
    });

    expect(records).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// publishOutboxEvent convenience helper
// ---------------------------------------------------------------------------

describe('publishOutboxEvent', () => {
  it('publishes exactly one event and returns it', async (ctx) => {
    requirePool(ctx);
    const record = await withTransaction(pool, async (client) => {
      const r = await publishOutboxEvent(client, {
        workspaceId: null,
        aggregateType: 'single_test',
        aggregateId: '00000000-0000-0000-0000-000000000050',
        eventType: 'document.version.ready',
        schemaVersion: 1,
        payload: { version: 42 },
      });

      expect(r.id).toBeTruthy();
      expect(r.eventType).toBe('document.version.ready');
      return r;
    });

    const row = await getRow(pool, record.id);
    expect(row).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Column constraint checks
// ---------------------------------------------------------------------------

describe('outbox_events column integrity', () => {
  it('has the expected status and default values', async (ctx) => {
    requirePool(ctx);
    const record = await withTransaction(pool, async (client) => {
      const records = await publishOutboxEvents({
        client,
        events: [
          {
            workspaceId: null,
            aggregateType: 'integrity',
            aggregateId: '00000000-0000-0000-0000-000000000060',
            eventType: 'document.upload.completed',
            schemaVersion: 1,
            payload: { check: true },
          },
        ],
      });
      return records[0]!;
    });

    const row = await getRow(pool, record.id);
    expect(row!.status).toBe('PENDING');
    expect(row!.attempt).toBe(0);
    expect(row!.publishedAt).toBeNull();
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.availableAt).toBeInstanceOf(Date);
  });
});
