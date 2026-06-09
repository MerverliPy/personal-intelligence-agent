export type {
  AuthenticatedPrincipal,
  SessionData,
  OidcConfig,
  AuthorizationParams,
  OidcUserInfo,
} from './types.js';

export { FakeOidcProvider, type TestUser } from './fake-oidc-provider.js';

export {
  type OidcClient,
  createFakeOidcClient,
  createRealOidcClient,
  generateCodeVerifier,
  computeCodeChallenge,
} from './oidc-client.js';

export {
  createSessionToken,
  verifySessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE,
} from './session.js';

export {
  authenticateRequest,
  authMiddleware,
  createAuthHandler,
  type AuthenticatedRequest,
  type AuthResult,
} from './middleware.js';
