import type { Pool } from 'pg';
import type { AuditEventInput } from './types.js';
import { redactAuditMetadata } from './redact.js';

/**
 * Audit event writer.
 *
 * All methods are **append-only** — there is no UPDATE, DELETE, or
 * modification path. Events are immutable once written.
 */
export interface AuditWriter {
  /**
   * Records a single audit event.
   *
   * The `metadata` field is redacted before persistence. Raw secrets,
   * tokens, credentials, and cookies are stripped per the security
   * governance spec §9.
   */
  write(event: AuditEventInput): Promise<void>;

  /**
   * Records multiple audit events in a single database transaction.
   * If any event fails validation, the entire batch is rolled back.
   */
  writeBatch(events: AuditEventInput[]): Promise<void>;
}

/**
 * Creates an {@link AuditWriter} backed by a PostgreSQL connection pool.
 */
export function createAuditWriter(pool: Pool): AuditWriter {
  async function insertOne(event: AuditEventInput): Promise<string> {
    const redacted = redactAuditMetadata(event.metadata ?? {});
    const result = await pool.query<{ id: string }>(
      `INSERT INTO audit_events (
         workspace_id, actor_id, actor_type, action, resource_type, resource_id,
         outcome, reason_code, request_id, trace_id, policy_decision, redacted_metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12
       ) RETURNING id`,
      [
        event.workspaceId ?? null,
        event.actorId ?? null,
        event.actorType,
        event.action,
        event.resourceType ?? null,
        event.resourceId ?? null,
        event.outcome,
        event.reasonCode ?? null,
        event.requestId,
        event.traceId ?? null,
        event.policyDecision ? JSON.stringify(event.policyDecision) : null,
        JSON.stringify(redacted),
      ],
    );
    return result.rows[0]!.id;
  }

  return {
    async write(event: AuditEventInput): Promise<void> {
      await insertOne(event);
    },

    async writeBatch(events: AuditEventInput[]): Promise<void> {
      if (events.length === 0) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const event of events) {
          const redacted = redactAuditMetadata(event.metadata ?? {});
          await client.query(
            `INSERT INTO audit_events (
               workspace_id, actor_id, actor_type, action, resource_type, resource_id,
               outcome, reason_code, request_id, trace_id, policy_decision, redacted_metadata
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11, $12
             )`,
            [
              event.workspaceId ?? null,
              event.actorId ?? null,
              event.actorType,
              event.action,
              event.resourceType ?? null,
              event.resourceId ?? null,
              event.outcome,
              event.reasonCode ?? null,
              event.requestId,
              event.traceId ?? null,
              event.policyDecision ? JSON.stringify(event.policyDecision) : null,
              JSON.stringify(redacted),
            ],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
