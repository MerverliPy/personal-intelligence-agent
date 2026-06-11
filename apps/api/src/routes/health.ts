import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@pia/contracts';
import { createPool } from '@pia/db';
import type { Pool } from 'pg';

let healthPool: Pool | null = null;

function getHealthPool(): Pool {
  if (!healthPool) {
    healthPool = createPool();
  }
  return healthPool;
}

/**
 * Health check routes.
 *
 * - `GET /health/live`  — Liveness: is the process alive?
 * - `GET /health/ready` — Readiness: are dependencies available?
 */
const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Clean up the health-check pool on server shutdown
  app.addHook('onClose', async () => {
    if (healthPool) {
      await healthPool.end();
      healthPool = null;
    }
  });

  app.get('/health/live', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.get('/health/ready', async (_request, reply): Promise<HealthResponse> => {
    try {
      const pool = getHealthPool();
      await pool.query('SELECT 1');

      return { status: 'ok', checks: { database: 'ok' } };
    } catch {
      void reply.status(503);
      return {
        status: 'unavailable',
        checks: { database: 'unavailable' },
      };
    }
  });
};

export default healthRoutes;
