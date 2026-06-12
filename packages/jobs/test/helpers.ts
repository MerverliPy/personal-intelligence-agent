import { Pool } from 'pg';
import { runMigrations, defaultMigrationsDir } from '@pia/db';

/**
 * Default connection to the PostgreSQL server (no database selected)
 * used to create/drop the test database.
 */
const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, '/postgres') ??
  'postgresql://pia:pia-dev@localhost:5432/postgres';

/** Database name used for integration tests. */
const TEST_DB_NAME = 'pia_jobs_test';

/** The test database connection URL. */
const TEST_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`) ??
  `postgresql://pia:pia-dev@localhost:5432/${TEST_DB_NAME}`;

let testPool: Pool | undefined;
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
 * connection pool pointed at it. Skips gracefully when PostgreSQL is
 * not available (returns null).
 *
 * Call {@link teardownTestDatabase} to release the pool after tests.
 */
export async function setupTestDatabase(): Promise<Pool | null> {
  if (testPool) return testPool;
  if (!(await isPostgresAvailable())) return null;

  // Connect to the admin database to create/drop the test database.
  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });

  try {
    // Terminate any existing connections to the test database.
    await adminPool.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid)
       FROM pg_stat_activity
       WHERE pg_stat_activity.datname = $1
         AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME],
    );

    // Drop and recreate.
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await adminPool.end();
  }

  // Connect to the test database and run migrations.
  testPool = new Pool({ connectionString: TEST_DATABASE_URL });

  const result = await runMigrations(testPool, defaultMigrationsDir());

  if (result.applied.length === 0) {
    throw new Error('No migrations were applied — expected at least 001_base_schema.sql');
  }

  return testPool;
}

/**
 * Releases the test pool. Should be called in an `afterAll` block.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
  }
}

export { TEST_DATABASE_URL };
