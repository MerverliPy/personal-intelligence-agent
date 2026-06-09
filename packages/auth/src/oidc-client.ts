import { randomBytes, createHash } from 'node:crypto';
import type { OidcConfig, AuthorizationParams, OidcUserInfo } from './types.js';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generates a PKCE code verifier (cryptographically random URL-safe string).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Computes the S256 PKCE code challenge from a verifier.
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
      // For testing, we send the verifier as the challenge directly
      // (the fake provider accepts challenge == verifier)
      const codeChallenge = computeCodeChallenge(codeVerifier);
      const state = randomBytes(16).toString('hex');

      const authUrl = new URL(`${issuerUrl}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);

      return {
        authorizationUrl: authUrl.toString(),
        codeVerifier,
        state,
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
// Real OIDC client (stub — implemented when openid-client is wired)
// ---------------------------------------------------------------------------

/**
 * Creates a production OIDC client using `openid-client`.
 *
 * Currently a stub that throws. Will be fully implemented when
 * a real OIDC provider (Keycloak, Auth0, etc.) is configured.
 */
export function createRealOidcClient(_config: OidcConfig): OidcClient {
  throw new Error(
    'Real OIDC client not yet implemented. Configure a real OIDC provider or use the fake client for testing.',
  );
}
