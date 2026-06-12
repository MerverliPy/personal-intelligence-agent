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

/** Advisory lock key used to serialize cross-worker database setup. */
const SETUP_LOCK_KEY = 1234567890;

/**
 * Creates a fresh test database, runs all migrations, and returns a
 * connection pool. Safe to call from multiple test files concurrently —
 * a PostgreSQL advisory lock serializes database creation and migration
 * application across vitest worker threads. The database is never
 * dropped during concurrent setup to avoid disrupting workers that are
 * already running tests.
 *
 * Returns null when PostgreSQL is not available.
 */
export async function setupTestDatabase(): Promise<Pool | null> {
  if (testPool) {
    return testPool;
  }

  if (!(await isPostgresAvailable())) return null;

  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });

  try {
    // Serialize database creation + migration across concurrent workers.
    await adminPool.query(`SELECT pg_advisory_lock(${SETUP_LOCK_KEY})`);

    try {
      if (!dbCreated) {
        // Create the test database if it does not already exist.
        // (Another worker may have created it; that's fine — migrations
        // are tracked inside the database and will be skipped on re-run.)
        try {
          await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          // 42P04 = DUPLICATE_DATABASE, 23505 = unique_violation on pg_database index
          if (code !== '42P04' && code !== '23505') throw err;
        }

        // Run migrations inside the lock so they are applied exactly once.
        const migrationPool = new Pool({ connectionString: TEST_DATABASE_URL });
        try {
          await runMigrations(migrationPool, defaultMigrationsDir());
        } finally {
          await migrationPool.end();
        }

        dbCreated = true;
      }
    } finally {
      await adminPool.query(`SELECT pg_advisory_unlock(${SETUP_LOCK_KEY})`);
    }
  } finally {
    await adminPool.end();
  }

  testPool = new Pool({ connectionString: TEST_DATABASE_URL });
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
