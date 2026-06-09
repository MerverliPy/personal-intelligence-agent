import { Redacted, redactRequired } from './redact.js';
import { type AppConfig, type AppMode, CONFIG_SCHEMA } from './schema.js';

/**
 * Error thrown when configuration validation fails.
 * Messages name missing keys but never contain secret values.
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly missingKeys: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Loads and validates the application configuration from environment variables.
 *
 * In `production` mode, all required fields must be set explicitly.
 * In `development` and `test` modes, safe defaults are used for non-required fields.
 *
 * @throws {ConfigValidationError} when required configuration is missing.
 */
export function loadConfig(): AppConfig {
  const raw = readRawEnv();
  const mode = parseMode(raw['NODE_ENV']);
  const errors: string[] = [];
  const missingKeys: string[] = [];

  // Validate all fields against the schema
  for (const [key, field] of Object.entries(CONFIG_SCHEMA)) {
    if (key === 'NODE_ENV') continue; // Already parsed

    const value = raw[key];
    if (value !== undefined && value.length > 0) continue; // Explicitly set

    if (field.required && mode === 'production') {
      errors.push(`Missing required config: ${field.env} (${field.description})`);
      missingKeys.push(field.env);
      continue;
    }

    if (field.required && field.default === undefined) {
      errors.push(
        `Missing required config: ${field.env} (${field.description}) — no default available`,
      );
      missingKeys.push(field.env);
      continue;
    }

    if (field.default !== undefined) {
      raw[key] = field.default;
    }
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      `Configuration validation failed:\n${errors.join('\n')}`,
      missingKeys,
    );
  }

  // Build the typed AppConfig — secret values are wrapped in Redacted
  return {
    mode,
    server: {
      port: parseInt(raw['PORT'] ?? '3000', 10),
      host: raw['HOST'] ?? '0.0.0.0',
    },
    database: {
      url: redactRequired(raw['DATABASE_URL']),
    },
    redis: {
      url: redactRequired(raw['REDIS_URL']),
    },
    auth: {
      oidcIssuer: raw['OIDC_ISSUER'] ?? 'http://localhost:8080/realms/pia',
      oidcClientId: raw['OIDC_CLIENT_ID'] ?? 'pia-local',
      oidcClientSecret: redactRequired(raw['OIDC_CLIENT_SECRET']),
      sessionSecret: redactRequired(raw['SESSION_SECRET']),
    },
    storage: {
      endpoint: raw['STORAGE_ENDPOINT'] ?? 'http://localhost:9000',
      bucket: raw['STORAGE_BUCKET'] ?? 'pia-local',
      accessKeyId: redactRequired(raw['STORAGE_ACCESS_KEY_ID']),
      secretAccessKey: redactRequired(raw['STORAGE_SECRET_ACCESS_KEY']),
    },
    logging: {
      level: parseLogLevel(raw['LOG_LEVEL']),
      format: parseLogFormat(raw['LOG_FORMAT']),
    },
  };
}

/**
 * Parses NODE_ENV into a valid `AppMode`.
 * Defaults to `'development'` if unset or invalid.
 */
function parseMode(raw: string | undefined): AppMode {
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }
  if (raw === undefined || raw.length === 0) {
    return 'development';
  }
  throw new ConfigValidationError(
    `Invalid NODE_ENV value: "${raw}". Must be one of: development, test, production.`,
    ['NODE_ENV'],
  );
}

function parseLogLevel(raw: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

function parseLogFormat(raw: string | undefined): 'json' | 'pretty' {
  if (raw === 'json') return 'json';
  return 'pretty';
}

/**
 * Reads all environment variables into a flat record.
 */
function readRawEnv(): Record<string, string | undefined> {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(CONFIG_SCHEMA)) {
    raw[key] = process.env[key];
  }
  return raw;
}

/**
 * Returns a safely serializable version of the config where all `Redacted`
 * values appear as `'[REDACTED]'`. Safe for logging.
 */
export function safeConfigForLogging(config: AppConfig): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(config, (_key, value) => {
      if (value instanceof Redacted) return '[REDACTED]';
      return value;
    }),
  ) as Record<string, unknown>;
}
