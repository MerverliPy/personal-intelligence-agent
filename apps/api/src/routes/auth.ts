import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Pool } from 'pg';
import type { OidcClient, OidcConfig, LoginTransactionStore, SessionData } from '@pia/auth';
import {
  generateState,
  generateNonce,
  createSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  resolveOrCreateUser,
} from '@pia/auth';

/**
 * Options passed to the auth routes plugin.
 */
export interface AuthRoutesOptions {
  oidcConfig: OidcConfig;
  oidcClient: OidcClient;
  loginStore: LoginTransactionStore;
  dbPool: Pool;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionData;
  }
}

/**
 * OIDC authentication routes plugin.
 *
 * Provides:
 * - `GET /auth/login`  — initiates the OIDC Authorization Code + PKCE flow
 * - `GET /auth/callback` — handles the OIDC callback, exchanges code for tokens
 * - `POST /auth/logout` — terminates the session
 */
const authRoutesPlugin: FastifyPluginAsync<AuthRoutesOptions> = async (
  app: FastifyInstance,
  opts: AuthRoutesOptions,
) => {
  const { oidcConfig, oidcClient, loginStore, dbPool } = opts;

  // ------------------------------------------------------------------
  // GET /auth/login — initiate OIDC flow
  // ------------------------------------------------------------------
  app.get('/auth/login', async (_request: FastifyRequest, reply: FastifyReply) => {
    const state = generateState();
    const nonce = generateNonce();

    const authParams = await oidcClient.getAuthorizationUrl();

    // Store the login transaction (state → {codeVerifier, nonce, redirectUri})
    await loginStore.create(
      state,
      {
        codeVerifier: authParams.codeVerifier,
        nonce,
        redirectUri: oidcConfig.redirectUri,
        returnUrl: '/',
      },
      300,
    ); // 5-minute TTL

    // Redirect user to the OIDC provider's authorization endpoint
    return reply.redirect(authParams.authorizationUrl, 302);
  });

  // ------------------------------------------------------------------
  // GET /auth/callback — handle OIDC callback
  // ------------------------------------------------------------------
  app.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const code = query['code'];
    const state = query['state'];
    const error = query['error'];
    const errorDescription = query['error_description'];

    // Handle OIDC error responses from the provider
    if (error) {
      return reply.status(400).send({
        error: {
          code: 'UNAUTHORIZED',
          message: errorDescription ?? error,
          request_id: request.id,
        },
      });
    }

    if (!code || !state) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing code or state parameter in callback.',
          request_id: request.id,
        },
      });
    }

    // Consume the login transaction (one-time use)
    const transaction = await loginStore.consume(state);
    if (!transaction) {
      return reply.status(400).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired login session. Please try logging in again.',
          request_id: request.id,
        },
      });
    }

    // Verify redirect URI consistency
    if (transaction.redirectUri !== oidcConfig.redirectUri) {
      return reply.status(400).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Redirect URI mismatch. Login flow may have been tampered with.',
          request_id: request.id,
        },
      });
    }

    let userInfoResult;
    try {
      // Exchange authorization code for tokens and retrieve user info.
      // The OIDC client (real) validates: ID token signature, iss, aud, exp.
      // State and nonce validation is handled by the library via checks.
      userInfoResult = await oidcClient.handleCallback(code, state, transaction.codeVerifier);
    } catch (err) {
      return reply.status(400).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. Please try logging in again.',
          request_id: request.id,
        },
      });
    }

    // Resolve or create the local user identity from the OIDC claims.
    // This transactional step maps (issuer, subject) → users.id via user_identities.
    let resolvedUser;
    try {
      resolvedUser = await resolveOrCreateUser(
        dbPool,
        oidcConfig.issuerUrl,
        userInfoResult.sub,
        userInfoResult.email,
        userInfoResult.name ?? undefined,
      );
    } catch {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred.',
          request_id: request.id,
        },
      });
    }

    // Create a session for the user
    const sessionData: SessionData = {
      userId: resolvedUser.userId,
      email: resolvedUser.email,
      displayName: userInfoResult.name,
      issuer: oidcConfig.issuerUrl,
      subject: userInfoResult.sub,
    };

    const sessionToken = await createSessionToken(
      sessionData,
      oidcConfig.sessionSecret,
      oidcConfig.sessionMaxAgeSeconds,
    );

    // Set the session cookie
    const cookieHeader = sessionCookieHeader(
      sessionToken,
      oidcConfig.sessionMaxAgeSeconds,
      oidcConfig.secureCookies,
    );
    void reply.header('set-cookie', cookieHeader);

    // Redirect to the return URL (or home)
    const returnUrl = transaction.returnUrl ?? '/';
    return reply.redirect(returnUrl, 302);
  });

  // ------------------------------------------------------------------
  // POST /auth/logout — terminate session
  // ------------------------------------------------------------------
  app.post('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    // NOTE: Server-side session revocation is deferred.
    // The session token remains valid until natural expiry (max 24h).
    // Mitigation: cookies are HttpOnly + SameSite=Lax.
    // A Redis-backed RevocationStore will enable full revocation (see P1-T02 run record).

    // Clear the session cookie
    const clearHeader = clearSessionCookieHeader(oidcConfig.secureCookies);
    void reply.header('set-cookie', clearHeader);

    return reply.send({ status: 'ok', message: 'Logged out.' });
  });
};

export default fp(authRoutesPlugin, {
  name: 'auth-routes',
  fastify: '5.x',
  dependencies: ['auth', 'correlation', 'request-id'],
});
