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
  revokeSession,
  sessionCookieHeader,
  clearSessionCookieHeader,
  InMemoryRevocationStore,
  SESSION_COOKIE,
  type RevocationStore,
  type VerifiedSessionPayload,
} from './session.js';

export {
  authenticateRequest,
  authMiddleware,
  createAuthHandler,
  type AuthenticatedRequest,
  type AuthResult,
} from './middleware.js';

export {
  evaluatePolicy,
  requireAuthorization,
  createPoolMembershipProvider,
  WORKSPACE_PERMISSION_ROLE,
  type MembershipProvider,
  type AuthorizedRequest,
  type RequireAuthorizationOptions,
} from './rbac.js';

export {
  type LoginTransactionStore,
  type LoginTransactionData,
  InMemoryLoginTransactionStore,
  RedisLoginTransactionStore,
  type RedisClient,
} from './login-store.js';

export { resolveOrCreateUser, type ResolvedIdentity } from './identity.js';
