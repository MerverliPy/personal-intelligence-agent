import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionData, OidcConfig } from './types.js';
import { SESSION_COOKIE, verifySessionToken } from './session.js';
import type { OidcClient } from './oidc-client.js';

/** Extended request with authenticated principal. */
export interface AuthenticatedRequest extends IncomingMessage {
  /** Authenticated session data, if any. */
  session?: SessionData;
}

/** Result of authenticating a request. */
export type AuthResult =
  | { authenticated: true; session: SessionData }
  | { authenticated: false; reason: string };

/**
 * Extracts and verifies the session from the request cookie.
 */
export async function authenticateRequest(
  req: IncomingMessage,
  config: OidcConfig,
): Promise<AuthResult> {
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) {
    return { authenticated: false, reason: 'No session cookie' };
  }

  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return { authenticated: false, reason: 'No session cookie' };
  }

  const session = await verifySessionToken(token, config.sessionSecret);

  if (!session) {
    return { authenticated: false, reason: 'Invalid or expired session' };
  }

  return { authenticated: true, session };
}

/**
 * Simple cookie parser. Does not handle quoted values.
 */
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

/**
 * HTTP middleware that authenticates requests.
 *
 * Returns `true` if the request is authenticated (session data is attached
 * to `req.session`). Returns `false` and writes a 401 response if not.
 *
 * Usage with a framework (e.g. Fastify via P1-T07):
 * ```ts
 * app.use(async (req, res, next) => {
 *   if (await authMiddleware(req, res, config)) next();
 * });
 * ```
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: ServerResponse,
  config: OidcConfig,
): Promise<boolean> {
  const result = await authenticateRequest(req, config);

  if (!result.authenticated) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized', message: result.reason }));
    return false;
  }

  req.session = result.session;
  return true;
}

/**
 * Creates a simple router-agnostic auth middleware function.
 *
 * @param config - OIDC configuration.
 * @param oidcClient - OIDC client for session re-validation (optional).
 * @returns A middleware function compatible with Node.js HTTP handlers.
 */
export function createAuthHandler(
  config: OidcConfig,
  _oidcClient?: OidcClient,
): (req: AuthenticatedRequest, res: ServerResponse) => Promise<SessionData | null> {
  return async (req: AuthenticatedRequest, _res: ServerResponse): Promise<SessionData | null> => {
    const result = await authenticateRequest(req, config);
    if (result.authenticated) {
      req.session = result.session;
      return result.session;
    }
    return null;
  };
}
