import type { JobEventType } from './types.js';

/**
 * Versioned event-schema registry.
 *
 * Every production event type MUST have a registered schema with a stable
 * version number. Consumers MUST tolerate additive fields (forward
 * compatibility). When a breaking change is required a new schema version
 * should be registered.
 *
 * The values are deliberately broad `Record<string, unknown>` contracts at
 * this layer; domain packages may narrow them for their own handlers.
 */

/** Schema-version mapping for every known event type. */
export const EVENT_SCHEMAS: ReadonlyMap<JobEventType, number> = new Map([
  ['document.upload.completed', 1],
  ['document.ingestion.requested', 1],
  ['document.version.ready', 1],
  ['conversation.response.completed', 1],
  ['feedback.recorded', 1],
  ['memory.candidate.created', 1],
  ['approval.requested', 1],
  ['tool.execution.completed', 1],
  ['evaluation.run.completed', 1],
]);

/**
 * Returns the registered schema version for `eventType`.
 * Returns `undefined` when the event type is not a recognised production
 * event (callers should handle gracefully).
 */
export function getSchemaVersion(eventType: string): number | undefined {
  return EVENT_SCHEMAS.get(eventType as JobEventType);
}
