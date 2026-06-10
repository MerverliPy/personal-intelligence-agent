import { redactSensitiveFields } from '@pia/observability';

/**
 * Redacts sensitive fields from audit metadata.
 *
 * Delegates to the observability package's redaction engine
 * which uses the built-in `SENSITIVE_LOG_FIELDS` set (already
 * covers passwords, tokens, secrets, cookies, keys, etc.).
 *
 * Returns a new object — the original is never mutated.
 */
export function redactAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return redactSensitiveFields(metadata);
}

/**
 * Redacts sensitive fields from an arbitrary payload for safe logging.
 * Delegates to `redactSensitiveFields` from the observability package.
 */
export function redactAuditPayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  return redactSensitiveFields(payload as Record<string, unknown>);
}
