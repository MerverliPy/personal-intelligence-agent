import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'node:crypto';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';

/**
 * Sets browser-enforced security headers on every response.
 */
async function securityHeadersHook(
  _request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<unknown> {
  void reply.header('X-Content-Type-Options', 'nosniff');
  void reply.header('X-Frame-Options', 'DENY');
  void reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  void reply.header(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  void reply.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  return payload;
}

const securityHeadersPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onSend', securityHeadersHook);
};

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '5.x',
});

/**
 * CSRF protection plugin.
 *
 * - On every response for an authenticated session, sets a CSRF token cookie
 *   (`XSRF-TOKEN`) if one is not already present.
 * - On every POST/PUT/PATCH/DELETE request with an authenticated session,
 *   validates that the `X-XSRF-TOKEN` header matches the cookie.
 * - Uses timing-safe comparison to prevent timing attacks.
 */
export const csrfPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Validate CSRF token on state-changing requests
  app.addHook('preHandler', async (request, reply) => {
    if (!request.session) return;

    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

    const cookies = parseCookies(request.headers['cookie'] ?? '');
    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (!cookieToken || typeof headerToken !== 'string' || headerToken.length === 0) {
      return reply.status(403).send({
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is required for state-changing requests.',
          request_id: request.id,
        },
      });
    }

    if (!timingSafeEqual(headerToken, cookieToken)) {
      return reply.status(403).send({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token does not match.',
          request_id: request.id,
        },
      });
    }
  });

  // Set CSRF cookie on authenticated responses that don't already have one
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.session) return payload;

    const cookies = parseCookies(request.headers['cookie'] ?? '');
    if (cookies[CSRF_COOKIE]) return payload; // Already has a token

    const token = crypto.randomBytes(32).toString('base64url');
    const existingSetCookie = reply.getHeader('set-cookie');
    const csrfCookie = `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; Max-Age=${24 * 3600}`;

    if (Array.isArray(existingSetCookie)) {
      void reply.header('Set-Cookie', [...existingSetCookie, csrfCookie]);
    } else if (typeof existingSetCookie === 'string') {
      void reply.header('Set-Cookie', [existingSetCookie, csrfCookie]);
    } else {
      void reply.header('Set-Cookie', csrfCookie);
    }

    return payload;
  });
};

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
