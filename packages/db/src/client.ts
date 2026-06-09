import { Pool, type PoolConfig } from 'pg';

/**
 * Default pool configuration for local development.
 * In production, DATABASE_URL must be set explicitly.
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pia:pia-dev@localhost:5432/pia',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

/**
 * Creates a new PostgreSQL connection pool.
 *
 * @param config - Optional pool configuration overrides.
 * @returns A configured `pg.Pool` instance.
 */
export function createPool(config?: Partial<PoolConfig>): Pool {
  return new Pool({ ...DEFAULT_POOL_CONFIG, ...config });
}
