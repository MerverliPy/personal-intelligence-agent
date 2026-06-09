/** Sensitive value marker — serializes as `[REDACTED]`. */
const REDACTED = Symbol('REDACTED');

/**
 * Wraps a string value for safe serialization.
 * The value is never included in `.toString()`, `JSON.stringify`, or template literals.
 */
export class Redacted {
  readonly [REDACTED] = true;

  constructor(private readonly _value: string) {}

  /** Returns `'[REDACTED]'` — never the actual value. */
  toString(): string {
    return '[REDACTED]';
  }

  /** Returns `'[REDACTED]'` — never the actual value. */
  toJSON(): string {
    return '[REDACTED]';
  }

  /** Returns the actual value. Use sparingly and never log. */
  expose(): string {
    return this._value;
  }
}

/**
 * Creates a `Redacted` wrapper if the value is truthy, otherwise returns `undefined`.
 * Use when a config value may not be set (e.g., optional secrets).
 */
export function redact(value: string | undefined): Redacted | undefined {
  if (value === undefined) return undefined;
  return new Redacted(value);
}

/**
 * Creates a `Redacted` wrapper for a required secret value.
 * Throws if the value is not a non-empty string.
 */
export function redactRequired(value: string | undefined): Redacted {
  if (value === undefined || value.length === 0) {
    throw new Error('Required secret value is empty');
  }
  return new Redacted(value);
}

/**
 * Deeply replaces all `Redacted` instances with `'[REDACTED]'` in an object
 * so it can be safely serialized for logging.
 */
export function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value instanceof Redacted) return '[REDACTED]';
    return value;
  });
}

/**
 * Returns true if the value is a `Redacted` instance.
 */
export function isRedacted(value: unknown): value is Redacted {
  return value instanceof Redacted;
}
