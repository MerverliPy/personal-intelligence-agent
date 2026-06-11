import { randomBytes, createHash } from 'node:crypto';
import {
  discovery,
  randomState,
  randomNonce,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  fetchUserInfo,
  ClientSecretPost,
  type Configuration,
  type AuthorizationCodeGrantChecks,
  type UserInfoResponse,
} from 'openid-client';
import type { OidcConfig, AuthorizationParams, OidcUserInfo } from './types.js';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generates a PKCE code verifier (cryptographically random URL-safe string).
 * Prefers `openid-client`'s implementation when available.
 */
export function generateCodeVerifier(): string {
  return randomPKCECodeVerifier();
}

/**
 * Computes the S256 PKCE code challenge from a verifier.
 * Prefers `openid-client`'s implementation when available.
 */
export function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ---------------------------------------------------------------------------
// OIDC Client interface
// ---------------------------------------------------------------------------

/**
 * Abstraction over OIDC authorization code flow with PKCE.
 *
 * Implementations:
 * - {@link createRealOidcClient} — production client using `openid-client`.
 * - {@link createFakeOidcClient} — test client that talks to {@link FakeOidcProvider}.
 */
export interface OidcClient {
  /** Build the authorization URL and return PKCE state. */
  getAuthorizationUrl(): Promise<AuthorizationParams>;

  /** Exchange authorization code for tokens and return user info. */
  handleCallback(code: string, state: string, codeVerifier: string): Promise<OidcUserInfo>;

  /** Return the issuer URL this client is configured for. */
  getIssuerUrl(): string;
}

// ---------------------------------------------------------------------------
// Fake OIDC client (for testing)
// ---------------------------------------------------------------------------

/**
 * Creates an OIDC client that talks to a {@link FakeOidcProvider} over HTTP.
 */
export function createFakeOidcClient(config: OidcConfig): OidcClient {
  const issuerUrl = config.issuerUrl;

  return {
    getIssuerUrl: () => issuerUrl,

    getAuthorizationUrl: async (): Promise<AuthorizationParams> => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = computeCodeChallenge(codeVerifier);
      const state = randomBytes(16).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      const authUrl = new URL(`${issuerUrl}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);

      return {
        authorizationUrl: authUrl.toString(),
        codeVerifier,
        state,
        nonce,
      };
    },

    handleCallback: async (
      code: string,
      _state: string,
      codeVerifier: string,
    ): Promise<OidcUserInfo> => {
      // Exchange code for tokens
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });

      const tokenRes = await fetch(`${issuerUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const err = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          `Token exchange failed: ${tokenRes.status} ${String(err['error_description'] ?? err['error'] ?? 'unknown')}`,
        );
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        id_token: string;
        token_type: string;
      };

      // Fetch user info
      const userRes = await fetch(`${issuerUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userRes.ok) {
        throw new Error(`UserInfo failed: ${userRes.status}`);
      }

      return (await userRes.json()) as OidcUserInfo;
    },
  };
}

// ---------------------------------------------------------------------------
// Real OIDC client (production, using openid-client)
// ---------------------------------------------------------------------------

/**
 * Creates a production OIDC client using `openid-client`.
 *
 * Performs provider discovery (`.well-known/openid-configuration`) at
 * construction time. The discovery result is cached.
 *
 * Each authorization flow:
 * 1. Generates fresh PKCE verifier/challenge, state, and nonce.
 * 2. Builds the provider authorization URL via `buildAuthorizationUrl`.
 * 3. Returns `(authorizationUrl, state, codeVerifier)` to the caller.
 *
 * The caller must:
 * - Store `(state → {codeVerifier, nonce})` server-side (see `LoginTransactionStore`).
 * - Pass the callback parameters to `handleCallback`.
 *
 * `handleCallback`:
 * - Calls `authorizationCodeGrant` to exchange the code for tokens.
 *   The library validates: ID token signature (JWKS), `iss`, `aud`, `exp`,
 *   `nonce`, and `state`.
 * - Calls `fetchUserInfo` to retrieve user claims.
 * - Returns `OidcUserInfo` (subset of standard claims).
 */
export function createRealOidcClient(config: OidcConfig): OidcClient {
  const issuerUrl = config.issuerUrl;
  let cachedConfig: Configuration | null = null;

  /**
   * Lazily discovers and caches the provider configuration.
   */
  async function getConfig(): Promise<Configuration> {
    if (cachedConfig) return cachedConfig;

    cachedConfig = await discovery(
      new URL(issuerUrl),
      config.clientId,
      undefined,
      ClientSecretPost(config.clientSecret),
    );

    return cachedConfig;
  }

  return {
    getIssuerUrl: () => issuerUrl,

    getAuthorizationUrl: async (): Promise<AuthorizationParams> => {
      const oidcConfig = await getConfig();
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const state = randomState();
      const nonce = randomNonce();

      const authUrl = buildAuthorizationUrl(oidcConfig, {
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
        redirect_uri: config.redirectUri,
      });

      return {
        authorizationUrl: authUrl.toString(),
        codeVerifier,
        state,
        nonce,
      };
    },

    handleCallback: async (
      code: string,
      state: string,
      codeVerifier: string,
    ): Promise<OidcUserInfo> => {
      const oidcConfig = await getConfig();

      // The current URL (callback) — openid-client needs this to extract
      // query parameters. We reconstruct it from config.
      const callbackUrl = new URL(config.redirectUri);
      callbackUrl.searchParams.set('code', code);
      callbackUrl.searchParams.set('state', state);

      // authorizationCodeGrant validates:
      // - ID Token signature (via JWKS from discovery)
      // - `iss` claim matches the issuer from discovery
      // - `aud` claim includes client_id
      // - `exp` claim (expiry)
      // - `nonce` claim (if nonce was set in authorization request)
      // - `state` parameter matches authorization response
      const checks: AuthorizationCodeGrantChecks = {
        expectedState: state,
      };

      const tokenSet = await authorizationCodeGrant(oidcConfig, callbackUrl, checks, {
        code_verifier: codeVerifier,
      });

      if (!tokenSet.access_token) {
        throw new Error('No access token returned by token endpoint');
      }

      // fetchUserInfo validates that the `sub` claim in the UserInfo response
      // matches the `sub` claim from the ID Token.
      const expectedSubject = tokenSet.claims()?.sub;
      if (!expectedSubject) {
        throw new Error('No subject claim in ID token');
      }

      let userInfo: UserInfoResponse;
      try {
        userInfo = await fetchUserInfo(oidcConfig, tokenSet.access_token, expectedSubject);
      } catch (err) {
        throw new Error(
          `UserInfo request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return {
        sub: userInfo.sub,
        email: userInfo.email ?? '',
        email_verified: userInfo.email_verified ?? false,
        name: userInfo.name ?? undefined,
        preferred_username: userInfo.preferred_username ?? undefined,
        picture: userInfo.picture ?? undefined,
      } satisfies OidcUserInfo;
    },
  };
}
