import { SignJWT, jwtVerify } from 'jose';
import type { SessionData } from './types.js';

/** Cookie name for the session token. */
export const SESSION_COOKIE = 'pia_session';

/**
 * Creates a signed JWT session token.
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
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}

/**
 * Verifies a JWT session token and returns the decoded session data.
 *
 * @param token - JWT string to verify.
 * @param secret - Symmetric key for verification (as Uint8Array).
 * @returns Decoded session data, or null if invalid/expired.
 */
export async function verifySessionToken(
  token: string,
  secret: Uint8Array,
): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload as unknown as SessionData;
  } catch {
    return null;
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
