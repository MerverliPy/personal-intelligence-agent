import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { OidcConfig, SessionData } from '@pia/auth';
import { authenticateRequest } from '@pia/auth';

/**
 * Extended Fastify request with authenticated session data.
 */
declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated session, set by the auth plugin. */
    session?: SessionData;
  }
}

/**
 * Auth plugin options.
 */
export interface AuthPluginOptions {
  oidcConfig: OidcConfig;
}

/**
 * Authentication plugin.
 *
 * - Extracts and verifies the session cookie on every request.
 * - Attaches `req.session` for authenticated requests.
 * - Does NOT reject unauthenticated requests here; routes decide
 *   whether auth is required via their own checks.
 */
const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  app: FastifyInstance,
  opts: AuthPluginOptions,
) => {
  app.decorateRequest('session', undefined);

  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = await authenticateRequest(request.raw, opts.oidcConfig);
    if (result.authenticated) {
      request.session = result.session;
    }
  });
};

/**
 * Helper that requires authentication for a route handler.
 *
 * Call at the start of each protected route. Returns the session
 * or throws a Fastify error (401) when the user is unauthenticated.
 */
export function requireAuth(request: FastifyRequest): SessionData {
  if (!request.session) {
    const err = new Error('Authentication required.') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return request.session;
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '5.x',
  dependencies: ['request-id'],
});
