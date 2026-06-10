import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import type { SessionData } from './types.js';

/** Cookie name for the session token. */
export const SESSION_COOKIE = 'pia_session';

/**
 * Interface for session revocation storage.
 *
 * Implementations:
 * - `InMemoryRevocationStore` — for development (process-local, lost on restart)
 * - Future: Redis-backed store for production
 */
export interface RevocationStore {
  /** Returns true if the session identified by `jti` has been revoked. */
  isRevoked(jti: string): Promise<boolean>;
  /** Revokes the session identified by `jti`. */
  revoke(jti: string, ttlSeconds: number): Promise<void>;
}

/**
 * In-memory revocation store for development use.
 * Does not persist across process restarts.
 */
export class InMemoryRevocationStore implements RevocationStore {
  private readonly revoked = new Map<string, number>(); // jti → expiry timestamp

  async isRevoked(jti: string): Promise<boolean> {
    const expiry = this.revoked.get(jti);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    this.revoked.set(jti, Date.now() + ttlSeconds * 1000);
  }
}

/**
 * Creates a signed JWT session token with a unique `jti` (JWT ID) claim
 * for server-side revocation support.
 *
 * @param data - Session data to encode.
 * @param secret - Symmetric key for signing (as Uint8Array).
 * @param maxAgeSeconds - Token lifetime in seconds.
 * @returns Signed JWT string.
 */
export async function createSessionToken(
  data: SessionData,
  secret: Uint8Array,
  maxAgeSeconds: number,
): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .setJti(jti)
    .sign(secret);
}

/**
 * Payload decoded from a verified JWT, including the `jti` claim.
 */
export interface VerifiedSessionPayload extends SessionData {
  jti?: string;
}

/**
 * Verifies a JWT session token, checks revocation status, and returns
 * the decoded session data.
 *
 * @param token - JWT string to verify.
 * @param secret - Symmetric key for verification (as Uint8Array).
 * @param revocationStore - Optional store to check for revoked sessions.
 * @returns Decoded session data, or null if invalid/expired/revoked.
 */
export async function verifySessionToken(
  token: string,
  secret: Uint8Array,
  revocationStore?: RevocationStore,
): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    // Check revocation if a store is provided and the token has a jti
    if (revocationStore && payload.jti) {
      const revoked = await revocationStore.isRevoked(payload.jti);
      if (revoked) {
        return null;
      }
    }

    // Extract session data without jti (which is internal)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { jti: _jti, ...sessionData } = payload as unknown as VerifiedSessionPayload;
    return sessionData as SessionData;
  } catch {
    return null;
  }
}

/**
 * Revokes a session token by its JWT string.
 *
 * Extracts the `jti` claim and stores it in the revocation store.
 * Revoked tokens will fail {@link verifySessionToken} checks.
 *
 * @param token - The JWT session token to revoke.
 * @param secret - The symmetric key used for verification.
 * @param revocationStore - The store to record the revocation in.
 */
export async function revokeSession(
  token: string,
  secret: Uint8Array,
  revocationStore: RevocationStore,
): Promise<void> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.jti) {
      // Revoke for the remaining lifetime of the token
      const exp = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = exp ? Math.max(0, exp - now) : 3600;
      await revocationStore.revoke(payload.jti, remainingSeconds);
    }
  } catch {
    // Token was already invalid — nothing to revoke
  }
}

/**
 * Builds the Set-Cookie header value for a session token.
 *
 * @param token - JWT session token.
 * @param maxAgeSeconds - Cookie max-age in seconds.
 * @param secure - Whether to set the Secure flag.
 */
export function sessionCookieHeader(token: string, maxAgeSeconds: number, secure: boolean): string {
  const parts: string[] = [
    `${SESSION_COOKIE}=${token}`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Builds the Set-Cookie header value to clear the session cookie.
 */
export function clearSessionCookieHeader(secure: boolean): string {
  const parts: string[] = [`${SESSION_COOKIE}=`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=0`];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
