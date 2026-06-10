import type { Pool } from 'pg';
import type { AuditEvent, AuditEventFilter, AuditEventPage } from './types.js';

/**
 * Audit event reader.
 *
 * All queries are **workspace-scoped**. The `workspaceId` filter is
 * REQUIRED and enforced — cross-workspace queries are impossible
 * through this API.
 *
 * Audit events are immutable; the reader only supports SELECT.
 */
export interface AuditReader {
  /**
   * Returns a paginated page of audit events for a workspace.
   *
   * @param filter — MUST include `workspaceId`. All other filters are optional.
   * @returns A page of events with a cursor for the next page.
   */
  query(filter: AuditEventFilter): Promise<AuditEventPage>;
}

/** Maps a PostgreSQL row to an {@link AuditEvent}. */
function rowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: row['id'] as string,
    workspaceId: (row['workspace_id'] as string) ?? null,
    actorId: (row['actor_id'] as string) ?? null,
    actorType: row['actor_type'] as AuditEvent['actorType'],
    action: row['action'] as string,
    resourceType: (row['resource_type'] as string) ?? null,
    resourceId: (row['resource_id'] as string) ?? null,
    outcome: row['outcome'] as AuditEvent['outcome'],
    reasonCode: (row['reason_code'] as string) ?? null,
    requestId: row['request_id'] as string,
    traceId: (row['trace_id'] as string) ?? null,
    policyDecision: (row['policy_decision'] as Record<string, unknown>) ?? null,
    redactedMetadata: (row['redacted_metadata'] as Record<string, unknown>) ?? {},
    occurredAt: row['occurred_at'] as Date,
  };
}

/**
 * Creates an {@link AuditReader} backed by a PostgreSQL connection pool.
 */
export function createAuditReader(pool: Pool): AuditReader {
  return {
    async query(filter: AuditEventFilter): Promise<AuditEventPage> {
      const limit = Math.min(Math.max(filter.limit ?? 100, 1), 1000);
      const clauses: string[] = ['workspace_id = $1'];
      const params: unknown[] = [filter.workspaceId];
      let paramIdx = 2;

      if (filter.actorId !== undefined) {
        clauses.push(`actor_id = $${paramIdx++}`);
        params.push(filter.actorId);
      }
      if (filter.action !== undefined) {
        clauses.push(`action = $${paramIdx++}`);
        params.push(filter.action);
      }
      if (filter.resourceType !== undefined) {
        clauses.push(`resource_type = $${paramIdx++}`);
        params.push(filter.resourceType);
      }
      if (filter.outcome !== undefined) {
        clauses.push(`outcome = $${paramIdx++}`);
        params.push(filter.outcome);
      }
      if (filter.from !== undefined) {
        clauses.push(`occurred_at >= $${paramIdx++}`);
        params.push(filter.from);
      }
      if (filter.to !== undefined) {
        clauses.push(`occurred_at <= $${paramIdx++}`);
        params.push(filter.to);
      }
      if (filter.cursor !== undefined) {
        clauses.push(`id > $${paramIdx++}`);
        params.push(filter.cursor);
      }

      const where = clauses.join(' AND ');
      const result = await pool.query<Record<string, unknown>>(
        `SELECT * FROM audit_events
         WHERE ${where}
         ORDER BY occurred_at DESC, id DESC
         LIMIT $${paramIdx++}`,
        [...params, limit + 1], // Fetch one extra to detect if there's a next page
      );

      const hasMore = result.rows.length > limit;
      const events = result.rows.slice(0, limit).map(rowToEvent);

      return {
        events,
        nextCursor: hasMore && events.length > 0 ? events[events.length - 1]!.id : null,
      };
    },
  };
}
