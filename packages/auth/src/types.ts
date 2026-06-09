/** Result of OIDC authentication — the authenticated principal. */
export interface AuthenticatedPrincipal {
  /** Internal user ID (UUID). */
  userId: string;
  /** User email. */
  email: string;
  /** Display name from the identity provider. */
  displayName?: string;
  /** OIDC issuer URL. */
  issuer: string;
  /** OIDC subject claim. */
  subject: string;
  /** Provider-specific claims (not exposed to domain APIs directly). */
  providerClaims: Record<string, unknown>;
}

/** Session data stored in the JWT and extracted by middleware. */
export interface SessionData {
  /** Internal user ID. */
  userId: string;
  /** User email. */
  email: string;
  /** Display name. */
  displayName?: string;
  /** OIDC issuer. */
  issuer: string;
  /** OIDC subject. */
  subject: string;
}

/** OIDC client configuration. */
export interface OidcConfig {
  /** OIDC issuer URL (e.g. https://accounts.example.com). */
  issuerUrl: string;
  /** OIDC client ID. */
  clientId: string;
  /** OIDC client secret (redacted). */
  clientSecret: string;
  /** Redirect URI for the authorization code callback. */
  redirectUri: string;
  /** Session encryption secret. */
  sessionSecret: Uint8Array;
  /** Session cookie max age in seconds. */
  sessionMaxAgeSeconds: number;
  /** Whether to use secure cookies (true in production). */
  secureCookies: boolean;
}

/** Parameters returned from the authorization URL step. */
export interface AuthorizationParams {
  /** Full URL to redirect the user to. */
  authorizationUrl: string;
  /** PKCE code verifier to store and use in token exchange. */
  codeVerifier: string;
  /** Opaque state parameter for CSRF protection. */
  state: string;
}

/** User info returned from the OIDC provider. */
export interface OidcUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
}
