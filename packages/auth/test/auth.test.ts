import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FakeOidcProvider } from '../src/fake-oidc-provider.js';
import { createFakeOidcClient } from '../src/oidc-client.js';
import {
  createSessionToken,
  verifySessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE,
} from '../src/session.js';
import { authenticateRequest, type AuthenticatedRequest } from '../src/middleware.js';
import type { OidcConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let provider: FakeOidcProvider;
let providerUrl: string;
let config: OidcConfig;
let sessionSecret: Uint8Array;

beforeAll(async () => {
  provider = new FakeOidcProvider();
  providerUrl = await provider.start();

  sessionSecret = new TextEncoder().encode('test-session-secret-at-least-32-bytes-long!!');

  config = {
    issuerUrl: providerUrl,
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    sessionSecret,
    sessionMaxAgeSeconds: 3600,
    secureCookies: false,
  };
}, 15_000);

afterAll(async () => {
  await provider.stop();
});

// ---------------------------------------------------------------------------
// FakeOidcProvider
// ---------------------------------------------------------------------------

describe('FakeOidcProvider', () => {
  it('starts and serves discovery', async () => {
    const res = await fetch(`${providerUrl}/.well-known/openid-configuration`);
    expect(res.status).toBe(200);
    const discovery = (await res.json()) as Record<string, unknown>;
    expect(discovery['issuer']).toBe(providerUrl);
    expect(discovery['authorization_endpoint']).toBe(`${providerUrl}/authorize`);
    expect(discovery['token_endpoint']).toBe(`${providerUrl}/token`);
    expect(discovery['userinfo_endpoint']).toBe(`${providerUrl}/userinfo`);
    expect(discovery['jwks_uri']).toBe(`${providerUrl}/jwks`);
    expect(discovery['code_challenge_methods_supported']).toContain('S256');
  });

  it('serves JWKS', async () => {
    const res = await fetch(`${providerUrl}/jwks`);
    expect(res.status).toBe(200);
    const jwks = (await res.json()) as Record<string, unknown>;
    expect(Array.isArray(jwks['keys'])).toBe(true);
    const keys = jwks['keys'] as Array<Record<string, unknown>>;
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0]?.['kid']).toBeTruthy();
  });

  it('redirects on authorize', async () => {
    const authUrl = new URL(`${providerUrl}/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'test-client');
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/cb');
    authUrl.searchParams.set('code_challenge', 'test-challenge');
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', 'test-state');

    const res = await fetch(authUrl.toString(), { redirect: 'manual' });
    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.searchParams.get('code')).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBe('test-state');
  });

  it('exchanges code for tokens', async () => {
    // Step 1: Get authorization code
    const authUrl = new URL(`${providerUrl}/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'test-client');
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/cb');
    authUrl.searchParams.set('code_challenge', 'pkce-challenge');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    const authRes = await fetch(authUrl.toString(), { redirect: 'manual' });
    const location = authRes.headers.get('location')!;
    const code = new URL(location).searchParams.get('code')!;
    expect(code).toBeTruthy();

    // Step 2: Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3000/cb',
      client_id: 'test-client',
      client_secret: 'test-secret',
      code_verifier: 'pkce-challenge',
    });

    const tokenRes = await fetch(`${providerUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    expect(tokenRes.status).toBe(200);
    const tokens = (await tokenRes.json()) as Record<string, unknown>;
    expect(tokens['access_token']).toBeTruthy();
    expect(tokens['id_token']).toBeTruthy();
    expect(tokens['token_type']).toBe('Bearer');
  });

  it('returns user info with valid access token', async () => {
    // Get an access token via the full flow
    const authUrl = new URL(`${providerUrl}/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'test-client');
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/cb');
    authUrl.searchParams.set('code_challenge', 'ui-challenge');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    const authRes = await fetch(authUrl.toString(), { redirect: 'manual' });
    const code = new URL(authRes.headers.get('location')!).searchParams.get('code')!;

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3000/cb',
      client_id: 'test-client',
      client_secret: 'test-secret',
      code_verifier: 'ui-challenge',
    });
    const tokenRes = await fetch(`${providerUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    const tokens = (await tokenRes.json()) as Record<string, unknown>;

    // UserInfo
    const uiRes = await fetch(`${providerUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens['access_token']}` },
    });
    expect(uiRes.status).toBe(200);
    const info = (await uiRes.json()) as Record<string, unknown>;
    expect(info['sub']).toBeTruthy();
    expect(info['email']).toBeTruthy();
  });

  it('rejects user info without token', async () => {
    const res = await fetch(`${providerUrl}/userinfo`);
    expect(res.status).toBe(401);
  });

  it('rejects double-use authorization code', async () => {
    const authUrl = new URL(`${providerUrl}/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'test-client');
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/cb');
    authUrl.searchParams.set('code_challenge', 'single-use');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    const authRes = await fetch(authUrl.toString(), { redirect: 'manual' });
    const code = new URL(authRes.headers.get('location')!).searchParams.get('code')!;

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3000/cb',
      client_id: 'test-client',
      client_secret: 'test-secret',
      code_verifier: 'single-use',
    });

    // First use — succeeds
    const res1 = await fetch(`${providerUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    expect(res1.status).toBe(200);

    // Second use — should fail
    const res2 = await fetch(`${providerUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    expect(res2.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// OIDC Client (Fake)
// ---------------------------------------------------------------------------

describe('createFakeOidcClient', () => {
  it('generates valid authorization URL', async () => {
    const client = createFakeOidcClient(config);
    const params = await client.getAuthorizationUrl();

    expect(params.authorizationUrl).toContain(providerUrl);
    expect(params.authorizationUrl).toContain('response_type=code');
    expect(params.authorizationUrl).toContain('code_challenge=');
    expect(params.authorizationUrl).toContain('code_challenge_method=S256');
    expect(params.codeVerifier).toBeTruthy();
    expect(params.state).toBeTruthy();
  });

  it('completes the authorization code flow end-to-end', async () => {
    const client = createFakeOidcClient(config);

    // Step 1: Get authorization URL
    const authParams = await client.getAuthorizationUrl();

    // Step 2: Simulate the user clicking through (fetch the auth URL with redirect: manual)
    const authRes = await fetch(authParams.authorizationUrl, { redirect: 'manual' });
    expect(authRes.status).toBe(302);
    const location = authRes.headers.get('location')!;
    const callbackUrl = new URL(location);
    const code = callbackUrl.searchParams.get('code')!;
    const state = callbackUrl.searchParams.get('state')!;

    // Step 3: Exchange code for user info
    const userInfo = await client.handleCallback(code, state, authParams.codeVerifier);
    expect(userInfo.sub).toBeTruthy();
    expect(userInfo.email).toBeTruthy();
    expect(userInfo.email_verified).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe('session tokens', () => {
  const testSession = {
    userId: 'user-123',
    email: 'alice@example.com',
    displayName: 'Alice Test',
    issuer: 'https://auth.example.com',
    subject: 'sub-1',
  };

  it('creates and verifies a valid session token', async () => {
    const token = await createSessionToken(testSession, sessionSecret, 3600);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const verified = await verifySessionToken(token, sessionSecret);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe('user-123');
    expect(verified!.email).toBe('alice@example.com');
    expect(verified!.issuer).toBe('https://auth.example.com');
  });

  it('rejects an expired session token', async () => {
    // Create a token that expires in 1 second
    const token = await createSessionToken(testSession, sessionSecret, 1);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const verified = await verifySessionToken(token, sessionSecret);
    expect(verified).toBeNull();
  });

  it('rejects a token with wrong secret', async () => {
    const token = await createSessionToken(testSession, sessionSecret, 3600);
    const otherSecret = new TextEncoder().encode('wrong-secret-needs-to-be-32-bytes!!');
    const verified = await verifySessionToken(token, otherSecret);
    expect(verified).toBeNull();
  });

  it('rejects a malformed token', async () => {
    const verified = await verifySessionToken('not-a-valid-jwt', sessionSecret);
    expect(verified).toBeNull();
  });

  it('generates correct Set-Cookie header', () => {
    const token = 'test-token-value';
    const header = sessionCookieHeader(token, 3600, false);
    expect(header).toContain(`${SESSION_COOKIE}=test-token-value`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=3600');
    expect(header).not.toContain('Secure');
  });

  it('generates secure Set-Cookie header in production mode', () => {
    const header = sessionCookieHeader('token', 3600, true);
    expect(header).toContain('Secure');
  });

  it('generates clear cookie header', () => {
    const header = clearSessionCookieHeader(false);
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header).toContain('Max-Age=0');
  });
});

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

describe('authenticateRequest', () => {
  it('returns unauthenticated for request without cookies', async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(false);
  });

  it('returns unauthenticated for request with missing session cookie', async () => {
    const req = {
      headers: { cookie: 'other_cookie=value' },
    } as AuthenticatedRequest;
    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(false);
  });

  it('returns authenticated for valid session cookie', async () => {
    const session = {
      userId: 'user-456',
      email: 'bob@example.com',
      issuer: config.issuerUrl,
      subject: 'test-user-2',
    };
    const token = await createSessionToken(session, sessionSecret, 3600);
    const req = {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    } as AuthenticatedRequest;

    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.session.userId).toBe('user-456');
      expect(result.session.email).toBe('bob@example.com');
    }
  });

  it('returns unauthenticated for expired session', async () => {
    const session = {
      userId: 'user-789',
      email: 'expired@example.com',
      issuer: config.issuerUrl,
      subject: 'test-user-3',
    };
    const token = await createSessionToken(session, sessionSecret, 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const req = {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    } as AuthenticatedRequest;

    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full end-to-end OIDC + session flow
// ---------------------------------------------------------------------------

describe('end-to-end OIDC auth flow', () => {
  it('completes the full flow: provider → OIDC client → session → auth check', async () => {
    const client = createFakeOidcClient(config);

    // 1. User hits login → redirected to OIDC provider
    const authParams = await client.getAuthorizationUrl();

    // 2. User authenticates at provider → redirected back with code
    const authRes = await fetch(authParams.authorizationUrl, { redirect: 'manual' });
    expect(authRes.status).toBe(302);
    const callbackUrl = new URL(authRes.headers.get('location')!);
    const code = callbackUrl.searchParams.get('code')!;
    const state = callbackUrl.searchParams.get('state')!;

    // 3. App exchanges code for tokens → gets user info
    const userInfo = await client.handleCallback(code, state, authParams.codeVerifier);
    expect(userInfo.email).toBe('alice@example.com');

    // 4. App creates a session from user info
    const sessionData = {
      userId: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      issuer: config.issuerUrl,
      subject: userInfo.sub,
    };
    const sessionToken = await createSessionToken(sessionData, sessionSecret, 3600);

    // 5. User makes subsequent request with session cookie
    const req = {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
    } as AuthenticatedRequest;

    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.session.userId).toBe(userInfo.sub);
      expect(result.session.email).toBe('alice@example.com');
    }

    // 6. Provider-specific claims do not leak into domain auth APIs
    //    (session only has userId, email, issuer, subject — no raw claims)
    if (result.authenticated) {
      const session = result.session as Record<string, unknown>;
      // No provider-specific claim keys leaked
      expect(session['email_verified']).toBeUndefined();
      expect(session['preferred_username']).toBeUndefined();
      expect(session['picture']).toBeUndefined();
    }
  });

  it('logout clears the session and subsequent requests are unauthenticated', async () => {
    // Create a valid session
    const sessionData = {
      userId: 'logout-user',
      email: 'logout@example.com',
      issuer: config.issuerUrl,
      subject: 'logout-sub',
    };
    const token = await createSessionToken(sessionData, sessionSecret, 3600);

    // Verify it works
    const req1 = {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    } as AuthenticatedRequest;
    const result1 = await authenticateRequest(req1, config);
    expect(result1.authenticated).toBe(true);

    // Logout: remove cookie
    const clearHeader = clearSessionCookieHeader(false);
    expect(clearHeader).toContain('Max-Age=0');

    // Subsequent request without the cookie (client cleared it)
    const req2 = { headers: {} } as AuthenticatedRequest;
    const result2 = await authenticateRequest(req2, config);
    expect(result2.authenticated).toBe(false);
  });

  it('invalid token (tampered) is rejected', async () => {
    const sessionData = {
      userId: 'tamper-user',
      email: 'tamper@example.com',
      issuer: config.issuerUrl,
      subject: 'tamper-sub',
    };
    const token = await createSessionToken(sessionData, sessionSecret, 3600);

    // Tamper with the token
    const parts = token.split('.');
    parts[1] = 'dGFtcGVyZWQ='; // base64 of "tampered"
    const tamperedToken = parts.join('.');

    const req = {
      headers: { cookie: `${SESSION_COOKIE}=${tamperedToken}` },
    } as AuthenticatedRequest;

    const result = await authenticateRequest(req, config);
    expect(result.authenticated).toBe(false);
  });
});
