import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

/** Represents a single migration file. */
export interface Migration {
  /** File name (e.g. "001_base_schema.sql"). */
  name: string;
  /** Raw SQL content. */
  sql: string;
}

/** Result of a migration run. */
export interface MigrationResult {
  /** Names of migrations that were applied during this run. */
  applied: string[];
}

/**
 * Ensures the `_migrations` tracking table exists.
 * The table is created by migration 001, but this guard handles the
 * bootstrapping case where no migrations have run yet.
 */
async function ensureTrackingTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Returns the set of already-applied migration names.
 */
async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  await ensureTrackingTable(pool);
  const result = await pool.query<{ name: string }>('SELECT name FROM _migrations');
  return new Set(result.rows.map((r) => r.name));
}

/**
 * Applies a single migration inside a transaction.
 * On failure the transaction is rolled back and the error is re-thrown.
 */
async function applyOne(pool: Pool, migration: Migration): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration.sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Loads migration files from a directory, sorted by name.
 *
 * @param migrationsDir - Absolute path to the directory containing `.sql` files.
 * @returns Sorted array of Migration objects.
 */
export function loadMigrations(migrationsDir: string): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => extname(f) === '.sql')
    .sort();

  return files.map((name) => ({
    name,
    sql: readFileSync(join(migrationsDir, name), 'utf8'),
  }));
}

/**
 * Applies all pending SQL migrations from `migrationsDir` against the given pool.
 *
 * Each migration is applied in its own transaction. Already-applied migrations
 * are skipped. Returns the names of migrations that were applied during this call.
 *
 * @param pool - Active PostgreSQL connection pool.
 * @param migrationsDir - Absolute path to the directory containing `.sql` files.
 * @returns Result with the list of applied migration names.
 */
export async function runMigrations(pool: Pool, migrationsDir: string): Promise<MigrationResult> {
  const applied = await getAppliedMigrations(pool);
  const migrations = loadMigrations(migrationsDir);
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }
    await applyOne(pool, migration);
    appliedNow.push(migration.name);
  }

  return { applied: appliedNow };
}

/**
 * Resolves the default migrations directory relative to this source file.
 * Useful as a default when no explicit directory is provided.
 */
export function defaultMigrationsDir(): string {
  const thisDir = fileURLToPath(new URL('.', import.meta.url));
  // From packages/db/src/ -> repo root
  return join(thisDir, '..', '..', '..', 'db', 'migrations');
}
