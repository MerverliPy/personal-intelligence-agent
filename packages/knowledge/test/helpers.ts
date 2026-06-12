import { Pool } from 'pg';
import { runMigrations, defaultMigrationsDir } from '@pia/db';

/**
 * Default connection to the PostgreSQL server (no database selected)
 * used to create/drop the test database.
 */
const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, '/postgres') ??
  'postgresql://pia:pia-dev@localhost:5432/postgres';

/** Database name used for knowledge integration tests. */
const TEST_DB_NAME = 'pia_knowledge_test';

/** The test database connection URL. */
const TEST_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`) ??
  `postgresql://pia:pia-dev@localhost:5432/${TEST_DB_NAME}`;

let testPool: Pool | undefined;
let dbCreated = false;
let dbAvailable: boolean | undefined;

/**
 * Returns true if PostgreSQL is reachable at the configured address.
 */
async function isPostgresAvailable(): Promise<boolean> {
  if (dbAvailable !== undefined) return dbAvailable;
  try {
    const probe = new Pool({
      connectionString: ADMIN_DATABASE_URL,
      connectionTimeoutMillis: 2000,
    });
    await probe.query('SELECT 1');
    await probe.end();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  return dbAvailable;
}

/**
 * Creates a fresh test database, runs all migrations, and returns a
 * connection pool. Safe to call from multiple test files — the database
 * is only created once per process. Returns null when PostgreSQL is
 * not available.
 */
export async function setupTestDatabase(): Promise<Pool | null> {
  if (testPool) {
    return testPool;
  }

  if (!(await isPostgresAvailable())) return null;

  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });

  try {
    if (!dbCreated) {
      // Terminate any existing connections to the test database.
      await adminPool.query(
        `SELECT pg_terminate_backend(pg_stat_activity.pid)
         FROM pg_stat_activity
         WHERE pg_stat_activity.datname = $1
           AND pid <> pg_backend_pid()`,
        [TEST_DB_NAME],
      );

      await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
      await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      dbCreated = true;
    }
  } finally {
    await adminPool.end();
  }

  testPool = new Pool({ connectionString: TEST_DATABASE_URL });
  await runMigrations(testPool, defaultMigrationsDir());

  return testPool;
}

/**
 * Releases the test pool. Call in `afterAll`.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
  }
}

export { TEST_DATABASE_URL };
