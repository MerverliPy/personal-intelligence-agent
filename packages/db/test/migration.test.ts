import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { runMigrations, defaultMigrationsDir } from '../src/migrate.js';

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

/** Returns the list of user-defined table names in the public schema. */
async function getUserTableNames(p: Pool): Promise<string[]> {
  const result = await p.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return result.rows.map((r) => r.tablename);
}

/** Returns enum type names in the public schema. */
async function getEnumTypes(p: Pool): Promise<string[]> {
  const result = await p.query<{ typname: string }>(`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname
  `);
  return result.rows.map((r) => r.typname);
}

/** Returns column names for a given table. */
async function getColumnNames(p: Pool, table: string): Promise<string[]> {
  const result = await p.query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [table],
  );
  return result.rows.map((r) => r.column_name);
}

// ---------------------------------------------------------------------------
// Migration correctness
// ---------------------------------------------------------------------------

describe('migration application', () => {
  it('applies from an empty database', async () => {
    const tables = await getUserTableNames(pool);
    // Core entity tables must exist
    expect(tables).toContain('users');
    expect(tables).toContain('workspaces');
    expect(tables).toContain('projects');
    // Audit/operations tables
    expect(tables).toContain('audit_events');
    expect(tables).toContain('outbox_events');
    expect(tables).toContain('idempotency_records');
    // Internal tracking table
    expect(tables).toContain('_migrations');
  });

  it('creates the expected enum types', async () => {
    const enums = await getEnumTypes(pool);
    expect(enums).toContain('workspace_role');
    expect(enums).toContain('membership_status');
    expect(enums).toContain('sensitivity_class');
  });

  it('is idempotent — running migrations again applies none', async () => {
    const result = await runMigrations(pool, defaultMigrationsDir());
    expect(result.applied).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Table structure checks
// ---------------------------------------------------------------------------

describe('tables have workspace ownership foundations', () => {
  it('users table has expected columns', async () => {
    const cols = await getColumnNames(pool, 'users');
    expect(cols).toContain('id');
    expect(cols).toContain('email');
    expect(cols).toContain('status');
    expect(cols).toContain('deleted_at');
  });

  it('workspaces table has expected columns', async () => {
    const cols = await getColumnNames(pool, 'workspaces');
    expect(cols).toContain('id');
    expect(cols).toContain('name');
    expect(cols).toContain('status');
    expect(cols).toContain('created_by');
    expect(cols).toContain('deleted_at');
  });

  it('workspace_members has composite PK on (workspace_id, user_id)', async () => {
    const result = await pool.query<{ column_name: string }>(`
      SELECT kc.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kc
        ON kc.constraint_name = tc.constraint_name
       AND kc.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name = 'workspace_members'
        AND tc.table_schema = 'public'
      ORDER BY kc.ordinal_position
    `);
    const pkCols = result.rows.map((r) => r.column_name);
    expect(pkCols).toEqual(['workspace_id', 'user_id']);
  });

  it('project_members FK references workspace_members', async () => {
    // This query will fail if the FK doesn't exist or columns mismatch
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'project_members'
          AND ccu.table_name = 'workspace_members'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audit, outbox, idempotency foundations
// ---------------------------------------------------------------------------

describe('audit_events', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'audit_events');
    expect(cols).toContain('workspace_id');
    expect(cols).toContain('actor_id');
    expect(cols).toContain('actor_type');
    expect(cols).toContain('action');
    expect(cols).toContain('outcome');
    expect(cols).toContain('request_id');
    expect(cols).toContain('redacted_metadata');
  });

  it('has workspace-scoped index', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'audit_events'
          AND indexname = 'audit_events_workspace_time_idx'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});

describe('outbox_events', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'outbox_events');
    expect(cols).toContain('workspace_id');
    expect(cols).toContain('aggregate_type');
    expect(cols).toContain('aggregate_id');
    expect(cols).toContain('event_type');
    expect(cols).toContain('payload');
    expect(cols).toContain('status');
    expect(cols).toContain('attempt');
  });

  it('has pending index', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'outbox_events_pending_idx'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});

describe('idempotency_records', () => {
  it('has expected columns', async () => {
    const cols = await getColumnNames(pool, 'idempotency_records');
    expect(cols).toContain('workspace_id');
    expect(cols).toContain('principal_id');
    expect(cols).toContain('operation');
    expect(cols).toContain('idempotency_key');
    expect(cols).toContain('request_hash');
    expect(cols).toContain('status');
    expect(cols).toContain('expires_at');
  });

  it('has unique constraint on (workspace_id, principal_id, operation, idempotency_key)', async () => {
    const result = await pool.query<{ column_name: string }>(`
      SELECT kc.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kc
        ON kc.constraint_name = tc.constraint_name
       AND kc.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_name = 'idempotency_records'
        AND tc.table_schema = 'public'
      ORDER BY kc.ordinal_position
    `);
    const uniqueCols = result.rows.map((r) => r.column_name);
    expect(uniqueCols).toEqual(
      expect.arrayContaining(['workspace_id', 'principal_id', 'operation', 'idempotency_key']),
    );
  });
});

// ---------------------------------------------------------------------------
// Constraint enforcement
// ---------------------------------------------------------------------------

describe('constraint enforcement', () => {
  it('rejects duplicate email for active users', async () => {
    // Insert a user
    await pool.query(`INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'dup@test.com')`);

    // Inserting another with same email should fail the unique partial index
    await expect(
      pool.query(`INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'dup@test.com')`),
    ).rejects.toThrow();
  });

  it('rejects duplicate (issuer, subject) on user_identities', async () => {
    const userId = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'ident@test.com') RETURNING id`,
    );
    const uid = userId.rows[0]!.id;

    await pool.query(
      `INSERT INTO user_identities (id, user_id, issuer, subject) VALUES (gen_random_uuid(), $1, 'https://auth.example.com', 'sub-1')`,
      [uid],
    );

    await expect(
      pool.query(
        `INSERT INTO user_identities (id, user_id, issuer, subject) VALUES (gen_random_uuid(), $1, 'https://auth.example.com', 'sub-1')`,
        [uid],
      ),
    ).rejects.toThrow();
  });

  it('rejects FK violation — workspace_members referencing non-existent user', async () => {
    const wsId = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'creator@test.com') RETURNING id`,
    );
    const workspaceResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Test WS', $1) RETURNING id`,
      [wsId.rows[0]!.id],
    );

    await expect(
      pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, gen_random_uuid(), 'MEMBER')`,
        [workspaceResult.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Transaction rollback behaviour
// ---------------------------------------------------------------------------

describe('transaction rollback', () => {
  it('rolls back on error within a transaction', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // This insert should succeed
      await client.query(
        `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'rollback@test.com')`,
      );

      // This FK violation should cause an error
      await expect(
        client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (gen_random_uuid(), gen_random_uuid(), 'MEMBER')`,
        ),
      ).rejects.toThrow();

      await client.query('ROLLBACK');

      // Verify the user was NOT committed
      const result = await pool.query(`SELECT 1 FROM users WHERE email = 'rollback@test.com'`);
      expect(result.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('commits successfully when all operations pass', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userId = await client.query<{ id: string }>(
        `INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'commit@test.com') RETURNING id`,
      );
      const uid = userId.rows[0]!.id;

      const wsResult = await client.query<{ id: string }>(
        `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), 'Commit WS', $1) RETURNING id`,
        [uid],
      );
      const wsid = wsResult.rows[0]!.id;

      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [wsid, uid],
      );

      await client.query('COMMIT');

      // Verify all data is present
      const userCheck = await pool.query(`SELECT 1 FROM users WHERE email = 'commit@test.com'`);
      expect(userCheck.rows).toHaveLength(1);

      const wsCheck = await pool.query(`SELECT 1 FROM workspaces WHERE name = 'Commit WS'`);
      expect(wsCheck.rows).toHaveLength(1);

      const memberCheck = await pool.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [wsid, uid],
      );
      expect(memberCheck.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

describe('extensions', () => {
  it('pgcrypto is installed', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('vector is installed', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('uuid-ossp is installed', async () => {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
      ) AS exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});
