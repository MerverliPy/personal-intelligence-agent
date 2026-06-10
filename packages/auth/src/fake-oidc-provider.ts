import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair, importJWK, type JWK } from 'jose';
import type { OidcUserInfo } from './types.js';

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

export interface TestUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  preferred_username: string;
}

const DEFAULT_USERS: TestUser[] = [
  {
    sub: 'test-user-1',
    email: 'alice@example.com',
    email_verified: true,
    name: 'Alice Test',
    preferred_username: 'alice',
  },
  {
    sub: 'test-user-2',
    email: 'bob@example.com',
    email_verified: true,
    name: 'Bob Test',
    preferred_username: 'bob',
  },
];

/** PKCE params stored during authorization. */
interface PendingAuth {
  codeChallenge: string;
  userSub: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Fake OIDC Provider
// ---------------------------------------------------------------------------

/**
 * A lightweight, in-process OIDC provider for integration testing.
 *
 * Supports:
 * - OIDC Discovery (/.well-known/openid-configuration)
 * - JWKS endpoint (/jwks)
 * - Authorization endpoint (/authorize) with PKCE (S256)
 * - Token endpoint (/token)
 * - UserInfo endpoint (/userinfo)
 *
 * Uses `jose` for JWT signing and verification. No external dependencies
 * beyond the Node.js standard library and `jose`.
 */
export class FakeOidcProvider {
  private server: Server | null = null;
  private port: number | null = null;
  private issuerUrl: string | null = null;

  private jwkPair: { publicKey: JWK; privateKey: JWK } | null = null;
  private kid = 'fake-oidc-key-1';

  /** Pending authorizations: code → PendingAuth */
  private pendingAuths = new Map<string, PendingAuth>();

  /** Active access tokens: token → user sub */
  private accessTokens = new Map<string, string>();

  private users: TestUser[];

  constructor(users?: TestUser[]) {
    this.users = users ?? DEFAULT_USERS;
  }

  /**
   * Starts the fake OIDC provider on a random available port.
   * Returns the issuer URL.
   */
  async start(): Promise<string> {
    // Generate a key pair for signing JWTs
    const kp = await generateKeyPair('ES256', { extractable: true });
    this.jwkPair = {
      publicKey: await exportJWK(kp.publicKey),
      privateKey: await exportJWK(kp.privateKey),
    };
    this.jwkPair.publicKey['kid'] = this.kid;
    this.jwkPair.privateKey['kid'] = this.kid;

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        if (typeof address === 'object' && address !== null) {
          this.port = address.port;
          this.issuerUrl = `http://127.0.0.1:${this.port}`;
          resolve(this.issuerUrl);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
      this.server.on('error', reject);
    });
  }

  /** Stops the fake provider and cleans up. */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => (err ? reject(err) : resolve()));
        this.server = null;
      } else {
        resolve();
      }
    });
  }

  /** Returns the issuer URL, or throws if not started. */
  getIssuerUrl(): string {
    if (!this.issuerUrl) throw new Error('FakeOidcProvider not started');
    return this.issuerUrl;
  }

  // -- Request routing --

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', this.issuerUrl!);
    const path = url.pathname;

    try {
      if (path === '/.well-known/openid-configuration') {
        this.handleDiscovery(res);
      } else if (path === '/jwks') {
        this.handleJwks(res);
      } else if (path === '/authorize' && req.method === 'GET') {
        this.handleAuthorize(url, res);
      } else if (path === '/token' && req.method === 'POST') {
        this.handleToken(req, res);
      } else if (path === '/userinfo' && req.method === 'GET') {
        this.handleUserInfo(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'server_error', error_description: String(err) }));
    }
  }

  // -- OIDC Discovery --

  private handleDiscovery(res: ServerResponse): void {
    const config = {
      issuer: this.issuerUrl,
      authorization_endpoint: `${this.issuerUrl}/authorize`,
      token_endpoint: `${this.issuerUrl}/token`,
      userinfo_endpoint: `${this.issuerUrl}/userinfo`,
      jwks_uri: `${this.issuerUrl}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['ES256'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
  }

  // -- JWKS --

  private handleJwks(res: ServerResponse): void {
    if (!this.jwkPair) {
      res.writeHead(500);
      res.end('Keys not initialized');
      return;
    }
    const pub = { ...this.jwkPair.publicKey };
    // Only expose public key fields
    const jwks = { keys: [pub] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jwks));
  }

  // -- Authorization endpoint --

  private handleAuthorize(url: URL, res: ServerResponse): void {
    const clientId = url.searchParams.get('client_id');
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const codeChallenge = url.searchParams.get('code_challenge');
    // scope is accepted but the fake provider always returns openid+email+profile

    if (!clientId || !redirectUri || !codeChallenge) {
      res.writeHead(400);
      res.end('Missing required parameters');
      return;
    }

    // Store the actual code challenge for PKCE verification at token exchange.
    const user = this.users[0]!;
    const code = randomBytes(32).toString('hex');

    this.pendingAuths.set(code, {
      codeChallenge,
      userSub: user.sub,
      expiresAt: Date.now() + 60_000, // 60 seconds
    });

    // Redirect back to the client
    const redirect = new URL(redirectUri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);

    res.writeHead(302, { Location: redirect.toString() });
    res.end();
  }

  // -- Token endpoint --

  private handleToken(req: IncomingMessage, res: ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const grantType = params.get('grant_type');
      const code = params.get('code');
      const codeVerifier = params.get('code_verifier');

      if (grantType !== 'authorization_code' || !code || !codeVerifier) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return;
      }

      const pending = this.pendingAuths.get(code);
      if (!pending) {
        res.writeHead(400);
        res.end(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Unknown or expired code' }),
        );
        return;
      }

      // Clean up pending auth
      this.pendingAuths.delete(code);

      // Verify PKCE: BASE64URL(SHA256(code_verifier)) must equal the challenge
      const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
      if (expectedChallenge !== pending.codeChallenge) {
        res.writeHead(400);
        res.end(
          JSON.stringify({ error: 'invalid_grant', error_description: 'PKCE verification failed' }),
        );
        return;
      }

      const user = this.users.find((u) => u.sub === pending.userSub);
      if (!user) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }

      this.issueTokens(user, res);
    });
  }

  private async issueTokens(user: TestUser, res: ServerResponse): Promise<void> {
    if (!this.jwkPair) {
      res.writeHead(500);
      res.end('Keys not initialized');
      return;
    }

    const privateKey = await importJWK(this.jwkPair.privateKey, 'ES256');

    const idToken = await new SignJWT({
      sub: user.sub,
      email: user.email,
      email_verified: user.email_verified,
      name: user.name,
      preferred_username: user.preferred_username,
    })
      .setProtectedHeader({ alg: 'ES256', kid: this.kid })
      .setIssuer(this.issuerUrl!)
      .setSubject(user.sub)
      .setAudience('test-client')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const accessToken = randomBytes(32).toString('hex');
    this.accessTokens.set(accessToken, user.sub);

    const response = {
      access_token: accessToken,
      token_type: 'Bearer',
      id_token: idToken,
      expires_in: 3600,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  // -- UserInfo endpoint --

  private handleUserInfo(req: IncomingMessage, res: ServerResponse): void {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }

    const accessToken = auth.slice(7);
    const sub = this.accessTokens.get(accessToken);
    if (!sub) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }

    const user = this.users.find((u) => u.sub === sub);
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }

    const info: OidcUserInfo = {
      sub: user.sub,
      email: user.email,
      email_verified: user.email_verified,
      name: user.name,
      preferred_username: user.preferred_username,
      picture: undefined,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info));
  }
}
