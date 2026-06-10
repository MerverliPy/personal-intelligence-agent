import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@pia/contracts';

/**
 * Health check routes.
 *
 * - `GET /health/live`  — Liveness: is the process alive?
 * - `GET /health/ready` — Readiness: are dependencies available?
 */
const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/health/live', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.get('/health/ready', async (_request, reply): Promise<HealthResponse> => {
    // Check database connectivity
    try {
      const { createPool } = await import('@pia/db');
      const pool = createPool();
      await pool.query('SELECT 1');
      await pool.end();

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
