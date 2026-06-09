import { SECRET_FIELD_NAMES } from '@pia/config';

/**
 * HTTP header and payload field names that always contain sensitive data and
 * MUST be redacted from structured log output.
 *
 * All entries are stored lowercase; lookups normalise via `.toLowerCase()`.
 */
const RAW_SENSITIVE_FIELDS = [
  // Authorization
  'authorization',
  'auth',
  'x-api-key',
  'api-key',
  'apikey',

  // Tokens & credentials
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'bearer',
  'credential',
  'credentials',
  'password',
  'passwd',
  'secret',

  // Session
  'cookie',
  'set-cookie',
  'setcookie',
  'session',
  'sessionid',
  'session_id',

  // Signatures
  'signature',
  'csrf',
  'csrftoken',
  'csrf_token',

  // Keys
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
  'apisecret',
  'api_secret',
  'encryptionkey',
  'encryption_key',
] as const;

/**
 * Construct the sensitive field set by adding the raw lowercased names and
 * any additional names from `@pia/config`'s SECRET_FIELD_NAMES (also lowercased).
 */
function buildSensitiveFieldSet(): Set<string> {
  const s = new Set<string>(RAW_SENSITIVE_FIELDS);
  for (const name of SECRET_FIELD_NAMES) {
    s.add(name.toLowerCase());
  }
  return s;
}

/** Frozen set of field-name patterns to redact (all lowercased). */
export const SENSITIVE_LOG_FIELDS: ReadonlySet<string> = buildSensitiveFieldSet();

/**
 * Maximum depth for recursive redaction to prevent infinite loops.
 */
const MAX_REDACT_DEPTH = 20;

/**
 * Deeply redacts values for keys whose lowercased name matches any entry in
 * `SENSITIVE_LOG_FIELDS`. The value is replaced with `'[REDACTED]'`.
 *
 * Returns a new object (or array) without mutating the input.
 */
export function redactSensitiveFields<T = Record<string, unknown>>(
  obj: T,
  maxDepth: number = MAX_REDACT_DEPTH,
): T {
  return _redact(obj, 0, maxDepth) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _redact(value: any, depth: number, maxDepth: number): any {
  if (depth >= maxDepth) return value;
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => _redact(item, depth, maxDepth));
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_LOG_FIELDS.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = _redact(val, depth + 1, maxDepth);
      }
    }
    return result;
  }

  return value;
}

/**
 * Returns a shallow copy of `meta` with all sensitive fields redacted.
 * The `message` string is returned verbatim.
 */
export function redactLogPayload(
  message: string,
  meta?: Record<string, unknown>,
): { message: string; meta: Record<string, unknown> | undefined } {
  return {
    message,
    meta: meta !== undefined ? redactSensitiveFields(meta) : undefined,
  };
}
