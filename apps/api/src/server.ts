import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { OidcConfig } from '@pia/auth';
import { createErrorEnvelope } from '@pia/contracts';
import requestIdPlugin from './plugins/request-id.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import type { AuthPluginOptions } from './plugins/auth.js';
import workspaceContextPlugin from './plugins/workspace-context.js';
import idempotencyPlugin from './plugins/idempotency.js';
import securityHeadersPlugin, { csrfPlugin } from './plugins/security.js';
import healthRoutes from './routes/health.js';
import workspaceRoutes from './routes/workspaces.js';
import uploadRoutes from './routes/uploads.js';
import webShell from './routes/web.js';

/**
 * Creates and configures the Fastify API server.
 *
 * Plugin registration order matters:
 * 1. request-id     — assigns correlation IDs to every request
 * 2. error-handler  — intercepts all errors, returns standard envelope
 * 3. cookie         — parses session cookies
 * 4. auth           — extracts session, attaches req.session
 * 5. workspace-ctx  — resolves workspace membership context
 * 6. idempotency    — handles Idempotency-Key for write operations
 * 7. routes         — health, identity, workspaces, etc.
 */
export async function createServer(opts: { oidcConfig: OidcConfig }) {
  const app = Fastify({
    logger: false, // We use @pia/observability logger instead
    genReqId: () => crypto.randomUUID(),
  });

  // ------------------------------------------------------------------
  // Plugins
  // ------------------------------------------------------------------
  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(fastifyCookie);
  await app.register(authPlugin, { oidcConfig: opts.oidcConfig } satisfies AuthPluginOptions);
  await app.register(workspaceContextPlugin);
  await app.register(idempotencyPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(csrfPlugin);

  // ------------------------------------------------------------------
  // Routes
  // ------------------------------------------------------------------
  await app.register(healthRoutes);
  await app.register(workspaceRoutes);
  await app.register(uploadRoutes);
  await app.register(webShell);

  // Add Content-Type for all responses
  app.addHook('onSend', async (_request, reply, payload) => {
    if (!reply.hasHeader('content-type')) {
      void reply.header('content-type', 'application/json; charset=utf-8');
    }
    return payload;
  });

  // Not-found handler for unmatched routes
  app.setNotFoundHandler(async (request, reply) => {
    return reply
      .status(404)
      .send(createErrorEnvelope('NOT_FOUND', 'The requested resource was not found.', request.id));
  });

  return app;
}
