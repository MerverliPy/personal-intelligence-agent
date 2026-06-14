import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { Pool } from 'pg';
import type { OidcConfig, OidcClient, LoginTransactionStore } from '@pia/auth';
import { InMemoryLoginTransactionStore, createFakeOidcClient } from '@pia/auth';
import type { AppMode } from '@pia/config';
import { createErrorEnvelope } from '@pia/contracts';
import requestIdPlugin from './plugins/request-id.js';
import correlationPlugin from './plugins/correlation.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import type { AuthPluginOptions } from './plugins/auth.js';
import workspaceContextPlugin from './plugins/workspace-context.js';
import idempotencyPlugin from './plugins/idempotency.js';
import securityHeadersPlugin, { csrfPlugin } from './plugins/security.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import auditPlugin from './plugins/audit.js';
import healthRoutes from './routes/health.js';
import workspaceRoutes from './routes/workspaces.js';
import uploadRoutes from './routes/uploads.js';
import documentRoutes from './routes/documents.js';
import retrievalRoutes from './routes/retrieval.js';
import conversationRoutes from './routes/conversations.js';
import feedbackRoutes from './routes/feedback.js';
import authRoutes from './routes/auth.js';
import webShell from './routes/web.js';
import webDocumentRoutes from './routes/web-documents.js';
import webConversationRoutes from './routes/web-conversations.js';

/**
 * Server creation options.
 */
export interface CreateServerOptions {
  oidcConfig: OidcConfig;
  mode: AppMode;
  /** OIDC client (production or fake). Defaults to fake client if not provided. */
  oidcClient?: OidcClient;
  /** Login transaction store. Defaults to InMemory if not provided. */
  loginStore?: LoginTransactionStore;
  /** PostgreSQL pool for identity mapping. Required for production auth routes. */
  dbPool?: Pool;
}

/**
 * Creates and configures the Fastify API server.
 *
 * Plugin registration order matters:
 * 1. request-id     — assigns correlation IDs to every request
 * 2. correlation    — wraps request in AsyncLocalStorage correlation context
 * 3. error-handler  — intercepts all errors, returns standard envelope
 * 4. cookie         — parses session cookies
 * 5. auth           — extracts session, attaches req.session
 * 6. workspace-ctx  — resolves workspace membership context
 * 7. idempotency    — handles Idempotency-Key for write operations
 * 8. rate-limit     — enforces per-route request rate limits
 * 9. routes         — health, identity, workspaces, etc.
 */
export async function createServer(opts: CreateServerOptions) {
  const {
    oidcConfig,
    mode,
    oidcClient = createFakeOidcClient(oidcConfig),
    loginStore = new InMemoryLoginTransactionStore(),
    dbPool,
  } = opts;

  const app = Fastify({
    logger: process.env['PIA_DEBUG_HTTP'] === '1' ? { level: 'info' } : false,
    genReqId: () => crypto.randomUUID(),
    trustProxy: mode === 'production',
  });

  // ------------------------------------------------------------------
  // Plugins
  // ------------------------------------------------------------------
  await app.register(requestIdPlugin);
  await app.register(correlationPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(fastifyCookie);
  await app.register(authPlugin, { oidcConfig } satisfies AuthPluginOptions);
  await app.register(workspaceContextPlugin);
  await app.register(idempotencyPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(csrfPlugin);
  await app.register(rateLimitPlugin);

  // ------------------------------------------------------------------
  // Routes
  // ------------------------------------------------------------------
  await app.register(healthRoutes);
  await app.register(workspaceRoutes);
  await app.register(uploadRoutes);
  await app.register(documentRoutes);
  await app.register(retrievalRoutes);
  await app.register(conversationRoutes);
  await app.register(feedbackRoutes);

  // Auth routes (login/callback/logout) and audit logging — only register if DB pool available
  if (dbPool) {
    await app.register(auditPlugin, { dbPool });
    await app.register(authRoutes, {
      oidcConfig,
      oidcClient,
      loginStore,
      dbPool,
    });
  }

  await app.register(webShell);
  await app.register(webDocumentRoutes);
  await app.register(webConversationRoutes);

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
