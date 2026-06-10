import type { PoolClient } from 'pg';
import type { OutboxRecord, OutboxEventInput, PublishOutboxEventsParams } from './types.js';
import { getSchemaVersion } from './schemas.js';

/**
 * Publishes one or more outbox events inside an existing database transaction.
 *
 * Events are inserted into the {@link outbox_events} table and returned so
 * callers can log or correlate the created IDs.
 *
 * **Important:** The caller must manage the transaction (BEGIN/COMMIT/ROLLBACK).
 * This function does not alter the transaction state — it only issues INSERT
 * statements against the supplied client.
 *
 * @param params.client - An active pg PoolClient, typically inside a transaction.
 * @param params.events   - One or more events to publish.
 * @returns The created outbox rows, in the same order as the input.
 *
 * @throws When an event type has no registered schema version.
 */
export async function publishOutboxEvents(
  params: PublishOutboxEventsParams,
): Promise<OutboxRecord[]> {
  const { client, events } = params;

  if (events.length === 0) {
    return [];
  }

  // Build a parameterised INSERT for all events.
  const placeholders: string[] = [];
  const values: unknown[] = [];
  let idx = 0;

  for (const event of events) {
    const schemaVersion = getSchemaVersion(event.eventType);
    if (schemaVersion === undefined) {
      throw new Error(`No schema version registered for event type "${event.eventType}"`);
    }

    const offset = idx * 8;
    placeholders.push(
      `($${offset + 1}::uuid, $${offset + 2}::text, $${offset + 3}::uuid, $${offset + 4}::text, $${offset + 5}::int, $${offset + 6}::jsonb, $${offset + 7}::text, $${offset + 8}::timestamptz)`,
    );

    values.push(
      event.workspaceId ?? null,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      schemaVersion,
      JSON.stringify(event.payload),
      'PENDING',
      event.availableAt ?? new Date(),
    );

    idx++;
  }

  const query = `
    INSERT INTO outbox_events (
      workspace_id,
      aggregate_type,
      aggregate_id,
      event_type,
      schema_version,
      payload,
      status,
      available_at
    )
    VALUES ${placeholders.join(', ')}
    RETURNING
      id,
      workspace_id AS "workspaceId",
      aggregate_type AS "aggregateType",
      aggregate_id AS "aggregateId",
      event_type AS "eventType",
      schema_version AS "schemaVersion",
      payload,
      status,
      attempt,
      available_at AS "availableAt",
      published_at AS "publishedAt",
      created_at AS "createdAt"
  `;

  const result = await client.query<OutboxRecord>(query, values);
  return result.rows;
}

/**
 * Convenience wrapper that publishes a single event.
 *
 * @see {@link publishOutboxEvents}
 */
export async function publishOutboxEvent(
  client: PoolClient,
  event: OutboxEventInput,
): Promise<OutboxRecord> {
  const records = await publishOutboxEvents({ client, events: [event] });
  return records[0]!;
}
