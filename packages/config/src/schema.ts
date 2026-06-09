import type { Redacted } from './redact.js';

/** Application run mode. */
export type AppMode = 'development' | 'test' | 'production';

/** Full typed application configuration. */
export interface AppConfig {
  readonly mode: AppMode;
  readonly server: {
    readonly port: number;
    readonly host: string;
  };
  readonly database: {
    readonly url: Redacted;
  };
  readonly redis: {
    readonly url: Redacted;
  };
  readonly auth: {
    readonly oidcIssuer: string;
    readonly oidcClientId: string;
    readonly oidcClientSecret: Redacted;
    readonly sessionSecret: Redacted;
  };
  readonly storage: {
    readonly endpoint: string;
    readonly bucket: string;
    readonly accessKeyId: Redacted;
    readonly secretAccessKey: Redacted;
  };
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly format: 'json' | 'pretty';
  };
}

/** Configuration field definition. */
export interface ConfigField {
  /** Environment variable name. */
  readonly env: string;
  /** Human-readable description for error messages. */
  readonly description: string;
  /** Whether the field contains a secret value. */
  readonly secret: boolean;
  /** Whether the field is required in production mode. */
  readonly required: boolean;
  /** Default value for non-production modes. */
  readonly default?: string;
}

/** Schema definition for all configuration fields. */
export const CONFIG_SCHEMA: Record<string, ConfigField> = {
  NODE_ENV: {
    env: 'NODE_ENV',
    description: 'Application run mode (development, test, production)',
    secret: false,
    required: false,
    default: 'development',
  },
  PORT: {
    env: 'PORT',
    description: 'Server port',
    secret: false,
    required: false,
    default: '3000',
  },
  HOST: {
    env: 'HOST',
    description: 'Server host',
    secret: false,
    required: false,
    default: '0.0.0.0',
  },
  DATABASE_URL: {
    env: 'DATABASE_URL',
    description: 'PostgreSQL connection URL',
    secret: true,
    required: true,
  },
  REDIS_URL: {
    env: 'REDIS_URL',
    description: 'Redis connection URL',
    secret: true,
    required: true,
  },
  OIDC_ISSUER: {
    env: 'OIDC_ISSUER',
    description: 'OpenID Connect issuer URL',
    secret: false,
    required: false,
    default: 'http://localhost:8080/realms/pia',
  },
  OIDC_CLIENT_ID: {
    env: 'OIDC_CLIENT_ID',
    description: 'OpenID Connect client identifier',
    secret: false,
    required: false,
    default: 'pia-local',
  },
  OIDC_CLIENT_SECRET: {
    env: 'OIDC_CLIENT_SECRET',
    description: 'OpenID Connect client secret',
    secret: true,
    required: true,
  },
  SESSION_SECRET: {
    env: 'SESSION_SECRET',
    description: 'Session encryption secret',
    secret: true,
    required: true,
  },
  STORAGE_ENDPOINT: {
    env: 'STORAGE_ENDPOINT',
    description: 'S3-compatible storage endpoint',
    secret: false,
    required: false,
    default: 'http://localhost:9000',
  },
  STORAGE_BUCKET: {
    env: 'STORAGE_BUCKET',
    description: 'Default storage bucket name',
    secret: false,
    required: false,
    default: 'pia-local',
  },
  STORAGE_ACCESS_KEY_ID: {
    env: 'STORAGE_ACCESS_KEY_ID',
    description: 'Storage access key identifier',
    secret: true,
    required: true,
  },
  STORAGE_SECRET_ACCESS_KEY: {
    env: 'STORAGE_SECRET_ACCESS_KEY',
    description: 'Storage secret access key',
    secret: true,
    required: true,
  },
  LOG_LEVEL: {
    env: 'LOG_LEVEL',
    description: 'Logging level (debug, info, warn, error)',
    secret: false,
    required: false,
    default: 'info',
  },
  LOG_FORMAT: {
    env: 'LOG_FORMAT',
    description: 'Log output format (json, pretty)',
    secret: false,
    required: false,
    default: 'pretty',
  },
} as const;

/** Names of the secret fields for redaction in logs. */
export const SECRET_FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.entries(CONFIG_SCHEMA)
    .filter(([, field]) => field.secret)
    .map(([name]) => name),
);
