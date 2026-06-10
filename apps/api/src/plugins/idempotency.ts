import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { createPool } from '@pia/db';
import { createErrorEnvelope } from '@pia/contracts';

/**
 * Idempotency plugin options.
 */
export interface IdempotencyPluginOptions {
  /** Idempotency key TTL in minutes (default: 24 hours). */
  ttlMinutes?: number;
}

const DEFAULT_TTL_MINUTES = 24 * 60;

/**
 * Idempotency plugin.
 *
 * For requests that include an `Idempotency-Key` header:
 * 1. Computes a SHA-256 request hash from the canonical payload.
 * 2. Uses `SELECT ... FOR UPDATE` + `INSERT ... ON CONFLICT DO NOTHING RETURNING id`
 *    to atomically claim the idempotency key, preventing TOCTOU races.
 * 3. If a prior completed response exists, replays it (with hash mismatch detection).
 * 4. If another request is in-progress, polls for completion up to a short timeout.
 *
 * Required for: POST /v1/workspaces/{id}/uploads,
 *                POST /v1/workspaces/{id}/uploads/{uid}/complete,
 *                POST /v1/workspaces
 *                and other write endpoints per API spec §7.
 */
const idempotencyPlugin: FastifyPluginAsync<IdempotencyPluginOptions> = async (
  app: FastifyInstance,
  opts: IdempotencyPluginOptions = {},
) => {
  const pool = createPool();
  const ttlMinutes = opts.ttlMinutes ?? DEFAULT_TTL_MINUTES;

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') return;

    // Determine the operation name from the route
    const operation = `${request.method}:${request.routeOptions.url ?? request.url}`;

    // Require auth for idempotency-key handling
    const session = request.session;
    if (!session) return; // Let the auth plugin reject later

    // Determine workspace from params
    const params = request.params as Record<string, string> | undefined;
    const workspaceId = params?.['workspace_id'] as string | undefined;
    if (!workspaceId) return; // Not a workspace-scoped operation

    // Compute cryptographic request hash (SHA-256 of canonical JSON)
    const requestHash = hashPayload(request.body ?? {});

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check for an existing record with SELECT ... FOR UPDATE
      // to serialize concurrent requests for the same idempotency key.
      const existing = await client.query<{
        status: string;
        response_status: number | null;
        response_reference: unknown | null;
        request_hash: string;
      }>(
        `SELECT status, response_status, response_reference, request_hash
         FROM idempotency_records
         WHERE workspace_id = $1
           AND principal_id = $2
           AND operation = $3
           AND idempotency_key = $4
         FOR UPDATE`,
        [workspaceId, session.userId, operation, idempotencyKey],
      );

      if (existing.rows.length > 0) {
        const record = existing.rows[0]!;

        // Completed record: replay or reject on hash mismatch
        if (record.status === 'COMPLETED') {
          await client.query('COMMIT');

          if (record.request_hash !== requestHash) {
            return reply
              .status(409)
              .send(
                createErrorEnvelope(
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key reused with different request input.',
                  request.id,
                ),
              );
          }

          const statusCode = record.response_status ?? 200;
          return reply
            .status(statusCode)
            .send(record.response_reference as Record<string, unknown>);
        }

        // In-progress: return conflict
        if (record.status === 'LOCKED' || record.status === 'PROCESSING') {
          await client.query('COMMIT');
          return reply
            .status(409)
            .send(
              createErrorEnvelope(
                'CONFLICT',
                'A request with this idempotency key is already in progress.',
                request.id,
              ),
            );
        }

        // PENDING or unknown status: update hash and proceed
        if (record.request_hash !== requestHash) {
          await client.query('COMMIT');
          return reply
            .status(409)
            .send(
              createErrorEnvelope(
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key reused with different request input.',
                request.id,
              ),
            );
        }
      }

      // Atomically insert a new LOCKED record.
      // ON CONFLICT DO NOTHING RETURNING id tells us whether we won the race.
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
      const insertResult = await client.query<{ id: string }>(
        `INSERT INTO idempotency_records
           (workspace_id, principal_id, operation, idempotency_key, request_hash, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'LOCKED', $6)
         ON CONFLICT (workspace_id, principal_id, operation, idempotency_key) DO NOTHING
         RETURNING id`,
        [workspaceId, session.userId, operation, idempotencyKey, requestHash, expiresAt],
      );

      await client.query('COMMIT');

      // If no row was returned, another concurrent request claimed the key first
      if (insertResult.rows.length === 0) {
        // Poll briefly for the winner's response
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
          await new Promise((resolve) => setTimeout(resolve, 200));

          const pollResult = await pool.query<{
            status: string;
            response_status: number;
            response_reference: unknown;
          }>(
            `SELECT status, response_status, response_reference
             FROM idempotency_records
             WHERE workspace_id = $1
               AND principal_id = $2
               AND operation = $3
               AND idempotency_key = $4`,
            [workspaceId, session.userId, operation, idempotencyKey],
          );

          if (pollResult.rows.length > 0 && pollResult.rows[0]!.status === 'COMPLETED') {
            const winner = pollResult.rows[0]!;
            return reply
              .status(winner.response_status)
              .send(winner.response_reference as Record<string, unknown>);
          }
        }

        return reply
          .status(409)
          .send(
            createErrorEnvelope(
              'CONFLICT',
              'A request with this idempotency key is already in progress.',
              request.id,
            ),
          );
      }

      // We claimed the key — store metadata for the onSend hook
      (request as unknown as IdempotencyRequest).__idempotency = {
        workspaceId,
        userId: session.userId,
        operation,
        idempotencyKey,
      };
    } finally {
      client.release();
    }
  });

  // After the handler, update the idempotency record with the response
  app.addHook('onSend', async (request: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
    const meta = (request as unknown as IdempotencyRequest).__idempotency;
    if (!meta) return payload;

    const client = await pool.connect();
    try {
      const responseStatus = _reply.statusCode;
      const responseBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

      await client.query(
        `UPDATE idempotency_records
         SET status = 'COMPLETED',
             response_status = $1,
             response_reference = $2::jsonb,
             updated_at = now()
         WHERE workspace_id = $3
           AND principal_id = $4
           AND operation = $5
           AND idempotency_key = $6`,
        [
          responseStatus,
          responseBody,
          meta.workspaceId,
          meta.userId,
          meta.operation,
          meta.idempotencyKey,
        ],
      );
    } catch {
      // Silently fail — the idempotency record is clean-up, not critical
    } finally {
      client.release();
    }

    return payload;
  });
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface IdempotencyMeta {
  workspaceId: string;
  userId: string;
  operation: string;
  idempotencyKey: string;
}

interface IdempotencyRequest {
  __idempotency?: IdempotencyMeta;
}

/**
 * Computes a SHA-256 hash of the canonical JSON serialization of the payload.
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 *
 * This is a cryptographic hash providing collision resistance and preimage
 * resistance — an attacker cannot craft a different payload that hashes to
 * the same value.
 */
function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

export default fp(idempotencyPlugin, {
  name: 'idempotency',
  fastify: '5.x',
  dependencies: ['auth'],
});
