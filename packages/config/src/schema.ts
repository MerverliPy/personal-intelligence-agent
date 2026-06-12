import type { Redacted } from './redact.js';

/** Application run mode. */
export type AppMode = 'development' | 'test' | 'production';

/** Full typed application configuration. */
export interface AppConfig {
  readonly mode: AppMode;
  readonly server: {
    readonly port: number;
    readonly host: string;
    readonly publicAppUrl: string;
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
  readonly embedding: {
    readonly provider: string;
    readonly model: string;
    readonly apiKey: Redacted;
    readonly dimensions: number;
    readonly version: string;
    readonly batchSize: number;
  };
  readonly model: {
    readonly provider: string;
    readonly name: string;
    readonly apiKey: Redacted;
    readonly maxTokens: number;
    readonly temperature: number;
    readonly timeoutMs: number;
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
    description: 'Server bind host',
    secret: false,
    required: false,
    default: '0.0.0.0',
  },
  PUBLIC_APP_URL: {
    env: 'PUBLIC_APP_URL',
    description:
      'Public-facing application URL (used for OIDC redirect URIs, distinct from bind address)',
    secret: false,
    required: false,
    default: 'http://localhost:3000',
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
  EMBEDDING_PROVIDER: {
    env: 'EMBEDDING_PROVIDER',
    description: 'Embedding provider identifier (fake, openai)',
    secret: false,
    required: false,
    default: 'fake',
  },
  EMBEDDING_MODEL: {
    env: 'EMBEDDING_MODEL',
    description: 'Embedding model name (e.g. text-embedding-3-small)',
    secret: false,
    required: false,
    default: 'fake-v1',
  },
  EMBEDDING_API_KEY: {
    env: 'EMBEDDING_API_KEY',
    description: 'API key for the embedding provider',
    secret: true,
    required: false,
    default: 'fake-key',
  },
  EMBEDDING_DIMENSIONS: {
    env: 'EMBEDDING_DIMENSIONS',
    description: 'Expected embedding vector dimensions',
    secret: false,
    required: false,
    default: '1536',
  },
  EMBEDDING_VERSION: {
    env: 'EMBEDDING_VERSION',
    description: 'Embedding pipeline version for provenance',
    secret: false,
    required: false,
    default: '1.0',
  },
  EMBEDDING_BATCH_SIZE: {
    env: 'EMBEDDING_BATCH_SIZE',
    description: 'Maximum number of chunks per provider request',
    secret: false,
    required: false,
    default: '20',
  },
  MODEL_PROVIDER: {
    env: 'MODEL_PROVIDER',
    description: 'Model gateway provider identifier (fake, openai)',
    secret: false,
    required: false,
    default: 'fake',
  },
  MODEL_NAME: {
    env: 'MODEL_NAME',
    description: 'Model name (e.g. gpt-4o)',
    secret: false,
    required: false,
    default: 'fake-v1',
  },
  MODEL_API_KEY: {
    env: 'MODEL_API_KEY',
    description: 'API key for the model provider',
    secret: true,
    required: false,
    default: 'fake-key',
  },
  MODEL_MAX_TOKENS: {
    env: 'MODEL_MAX_TOKENS',
    description: 'Default maximum tokens per generation request',
    secret: false,
    required: false,
    default: '4096',
  },
  MODEL_TEMPERATURE: {
    env: 'MODEL_TEMPERATURE',
    description: 'Default sampling temperature (0-2)',
    secret: false,
    required: false,
    default: '0.7',
  },
  MODEL_TIMEOUT_MS: {
    env: 'MODEL_TIMEOUT_MS',
    description: 'Request timeout in milliseconds',
    secret: false,
    required: false,
    default: '30000',
  },
} as const;

/** Names of the secret fields for redaction in logs. */
export const SECRET_FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.entries(CONFIG_SCHEMA)
    .filter(([, field]) => field.secret)
    .map(([name]) => name),
);
