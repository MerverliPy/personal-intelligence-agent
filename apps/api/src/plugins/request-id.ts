import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Maximum length for externally-supplied request IDs.
 * Longer values are rejected to prevent log/header abuse.
 */
const MAX_INBOUND_ID_LENGTH = 64;

/**
 * Safe character set for externally-supplied request IDs.
 * Only alphanumeric, hyphens, and underscores are permitted.
 */
const SAFE_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;

/**
 * Request-ID plugin.
 *
 * - Generates a UUID-based request ID on server entry.
 * - Echoes the client-supplied `X-Request-ID` header if it passes
 *   validation (length ≤ 64, safe characters only).
 * - Sets the `X-Request-ID` response header on every reply.
 */
const requestIdPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    const clientId = request.headers['x-request-id'];

    if (typeof clientId === 'string' && clientId.length > 0) {
      if (clientId.length > MAX_INBOUND_ID_LENGTH) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'X-Request-ID exceeds maximum length of 64 characters.',
            request_id: request.id,
          },
        });
      }

      if (!SAFE_ID_PATTERN.test(clientId)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'X-Request-ID contains invalid characters.',
            request_id: request.id,
          },
        });
      }

      request.id = clientId;
    }

    void reply.header('x-request-id', request.id);
  });
};

export default fp(requestIdPlugin, {
  name: 'request-id',
  fastify: '5.x',
});
