import type { Pool, PoolClient } from 'pg';

/**
 * Result of resolving an OIDC identity to a local user.
 */
export interface ResolvedIdentity {
  /** Stable internal user ID (UUID). */
  userId: string;
  /** Whether this is a new user (first login). */
  isNewUser: boolean;
  /** Whether this identity was just created (first login with this provider). */
  isNewIdentity: boolean;
  /** User email. */
  email: string;
}

/**
 * Resolves or creates a local user from an OIDC identity.
 *
 * This function MUST run inside a database transaction. It performs:
 *
 * 1. Upserts the `users` row by email.
 * 2. Inserts the `user_identities` row for `(issuer, subject)` with
 *    `ON CONFLICT DO NOTHING` to handle concurrent first-login races.
 * 3. If the INSERT was a no-op (another transaction won the race),
 *    SELECTs the existing `user_id` from `user_identities`.
 * 4. Returns the stable `users.id`.
 *
 * @param client - An active PostgreSQL client (from Pool or PoolClient within a transaction).
 * @param issuer - OIDC issuer URL.
 * @param subject - OIDC subject claim.
 * @param email - User email from the OIDC provider.
 * @param displayName - Optional display name from the OIDC provider.
 * @returns Resolved identity with stable user ID and flags.
 */
export async function resolveOrCreateUser(
  client: Pool | PoolClient,
  issuer: string,
  subject: string,
  email: string,
  displayName?: string,
): Promise<ResolvedIdentity> {
  // Determine whether this is a new user before the upsert.
  const preCheck = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email],
  );
  const isNewUser = preCheck.rows.length === 0;

  // 1. Upsert the user by email.
  const userResult = await client.query<{ id: string; email: string }>(
    `INSERT INTO users (email, display_name)
     VALUES ($1, $2)
     ON CONFLICT (lower(email)) WHERE deleted_at IS NULL
     DO UPDATE SET last_seen_at = now(),
                   display_name = COALESCE($2, users.display_name)
     RETURNING id, email`,
    [email, displayName ?? null],
  );

  const userRow = userResult.rows[0];
  if (!userRow) {
    // The partial unique index didn't match (e.g. deleted user exists).
    // Fall back to a SELECT to find the active user.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
      [email],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error(`Failed to resolve user for email: ${email}`);
    }
  }

  const userId =
    userRow?.id ??
    (
      await client.query<{ id: string }>(
        `SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
        [email],
      )
    ).rows[0]?.id;

  if (!userId) {
    throw new Error(`Failed to resolve user for email: ${email}`);
  }

  // 2. Insert the user_identities row with ON CONFLICT DO NOTHING.
  const identityResult = await client.query<{ user_id: string }>(
    `INSERT INTO user_identities (user_id, issuer, subject, claims_metadata, last_seen_at)
     VALUES ($1, $2, $3, '{}'::jsonb, now())
     ON CONFLICT (issuer, subject) DO NOTHING
     RETURNING user_id`,
    [userId, issuer, subject],
  );

  let resolvedUserId: string;
  let isNewIdentity = false;

  if (identityResult.rows.length > 0 && identityResult.rows[0] !== undefined) {
    resolvedUserId = identityResult.rows[0].user_id;
    isNewIdentity = true;
  } else {
    // ON CONFLICT DO NOTHING returned no row. Read the existing row.
    const existing = await client.query<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE issuer = $1 AND subject = $2`,
      [issuer, subject],
    );

    if (existing.rows.length === 0 || existing.rows[0] === undefined) {
      // Safety retry: shouldn't happen due to unique constraint.
      const retry = await client.query<{ user_id: string }>(
        `INSERT INTO user_identities (user_id, issuer, subject, claims_metadata, last_seen_at)
         VALUES ($1, $2, $3, '{}'::jsonb, now())
         ON CONFLICT (issuer, subject) DO UPDATE SET last_seen_at = now()
         RETURNING user_id`,
        [userId, issuer, subject],
      );
      if (retry.rows.length > 0 && retry.rows[0] !== undefined) {
        resolvedUserId = retry.rows[0].user_id;
        isNewIdentity = true;
      } else {
        throw new Error('Failed to resolve user identity after retry');
      }
    } else {
      resolvedUserId = existing.rows[0].user_id;
      await client.query(
        `UPDATE user_identities SET last_seen_at = now() WHERE issuer = $1 AND subject = $2`,
        [issuer, subject],
      );
    }
  }

  return {
    userId: resolvedUserId,
    isNewUser,
    isNewIdentity,
    email,
  };
}
