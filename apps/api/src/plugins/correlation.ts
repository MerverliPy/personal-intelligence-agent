import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { runWithCorrelation, createCorrelationContext } from '@pia/observability';

/**
 * Correlation plugin.
 *
 * Wraps every incoming request in a correlation context via
 * `AsyncLocalStorage`. The correlation ID is derived from the
 * request ID (assigned by the request-id plugin, which runs first).
 *
 * Route handlers and downstream plugins can access the correlation
 * context through `@pia/observability`'s `getCorrelationContext()` or
 * `getCurrentCorrelationId()`. The structured logger automatically
 * includes the correlation ID in every log entry.
 */
const correlationPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', (request, _reply, done) => {
    const ctx = createCorrelationContext(request.id);
    runWithCorrelation(() => {
      done();
    }, ctx);
  });
};

export default fp(correlationPlugin, {
  name: 'correlation',
  fastify: '5.x',
  dependencies: ['request-id'],
});
