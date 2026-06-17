import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, ConfigValidationError, safeConfigForLogging } from '../src/loader.js';
import { Redacted, safeStringify, isRedacted } from '../src/redact.js';
import { SECRET_FIELD_NAMES } from '../src/schema.js';
import type { AppConfig } from '../src/schema.js';

/**
 * Helper to set environment variables for a test and restore them after.
 */
function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('loadConfig', () => {
  describe('development mode', () => {
    it('loads with all required secrets provided', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/test',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'oidc-secret-123',
          SESSION_SECRET: 'session-secret-456',
          STORAGE_ACCESS_KEY_ID: 'minioadmin',
          STORAGE_SECRET_ACCESS_KEY: 'minioadmin123',
        },
        () => {
          const config = loadConfig();
          expect(config.mode).toBe('development');
          expect(config.server.port).toBe(3000);
          expect(config.server.host).toBe('0.0.0.0');
          expect(config.logging.level).toBe('info');
          expect(config.logging.format).toBe('pretty');
        },
      );
    });

    it('uses defaults for optional fields when not set', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/test',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'oidc-secret',
          SESSION_SECRET: 'session-secret',
          STORAGE_ACCESS_KEY_ID: 'minioadmin',
          STORAGE_SECRET_ACCESS_KEY: 'minioadmin123',
        },
        () => {
          const config = loadConfig();
          expect(config.auth.oidcIssuer).toBe('http://localhost:8080/realms/pia');
          expect(config.auth.oidcClientId).toBe('pia-local');
          expect(config.storage.endpoint).toBe('http://localhost:9000');
          expect(config.storage.bucket).toBe('pia-local');
        },
      );
    });
  });

  describe('test mode', () => {
    it('loads with defaults for non-required fields', () => {
      withEnv(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://localhost/test',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'test-secret',
          SESSION_SECRET: 'test-session-secret',
          STORAGE_ACCESS_KEY_ID: 'test-key',
          STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
        },
        () => {
          const config = loadConfig();
          expect(config.mode).toBe('test');
        },
      );
    });
  });

  describe('production mode', () => {
    it('rejects missing required config without defaults', () => {
      withEnv({ NODE_ENV: 'production' }, () => {
        expect(() => loadConfig()).toThrow(ConfigValidationError);
        try {
          loadConfig();
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigValidationError);
          const err = error as ConfigValidationError;
          // Error message names missing keys
          expect(err.message).toContain('DATABASE_URL');
          expect(err.message).toContain('REDIS_URL');
          expect(err.message).toContain('OIDC_ISSUER');
          expect(err.message).toContain('OIDC_CLIENT_ID');
          expect(err.message).toContain('OIDC_CLIENT_SECRET');
          expect(err.message).toContain('SESSION_SECRET');
          expect(err.message).toContain('STORAGE_ACCESS_KEY_ID');
          expect(err.message).toContain('STORAGE_SECRET_ACCESS_KEY');
          // missingKeys contains the env var names
          expect(err.missingKeys).toContain('DATABASE_URL');
          expect(err.missingKeys).toContain('REDIS_URL');
          expect(err.missingKeys).toContain('OIDC_ISSUER');
          expect(err.missingKeys).toContain('OIDC_CLIENT_ID');
        }
      });
    });

    it('requires explicit OIDC issuer and client ID in production', () => {
      withEnv(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://prod-host/db',
          REDIS_URL: 'redis://prod-host:6379',
          OIDC_ISSUER: undefined,
          OIDC_CLIENT_ID: undefined,
          OIDC_CLIENT_SECRET: 'prod-oidc-secret',
          SESSION_SECRET: 'prod-session-secret',
          STORAGE_ACCESS_KEY_ID: 'prod-key',
          STORAGE_SECRET_ACCESS_KEY: 'prod-secret',
        },
        () => {
          expect(() => loadConfig()).toThrow(ConfigValidationError);

          try {
            loadConfig();
          } catch (error) {
            const err = error as ConfigValidationError;
            expect(err.missingKeys).toEqual(['OIDC_ISSUER', 'OIDC_CLIENT_ID']);
          }
        },
      );
    });

    it('loads successfully when all required config is set', () => {
      withEnv(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://prod-host/db',
          REDIS_URL: 'redis://prod-host:6379',
          OIDC_ISSUER: 'https://login.example.com',
          OIDC_CLIENT_ID: 'pia-production',
          OIDC_CLIENT_SECRET: 'prod-oidc-secret',
          SESSION_SECRET: 'prod-session-secret',
          STORAGE_ACCESS_KEY_ID: 'prod-key',
          STORAGE_SECRET_ACCESS_KEY: 'prod-secret',
        },
        () => {
          const config = loadConfig();
          expect(config.mode).toBe('production');
          // Production still allows non-required field defaults
          expect(config.server.port).toBe(3000);
        },
      );
    });

    it('overrides defaults when explicitly set', () => {
      withEnv(
        {
          NODE_ENV: 'production',
          PORT: '8080',
          HOST: '127.0.0.1',
          DATABASE_URL: 'postgresql://prod/db',
          REDIS_URL: 'redis://prod:6379',
          OIDC_ISSUER: 'https://login.example.com',
          OIDC_CLIENT_ID: 'pia-production',
          OIDC_CLIENT_SECRET: 'secret',
          SESSION_SECRET: 'secret',
          STORAGE_ACCESS_KEY_ID: 'key',
          STORAGE_SECRET_ACCESS_KEY: 'secret',
        },
        () => {
          const config = loadConfig();
          expect(config.server.port).toBe(8080);
          expect(config.server.host).toBe('127.0.0.1');
        },
      );
    });
  });

  describe('error messages never print secret values', () => {
    it('error message names the env variable but not its value', () => {
      withEnv(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:SuperSecret123@host/db',
        },
        () => {
          try {
            loadConfig();
          } catch (error) {
            const msg = (error as Error).message;
            // Names missing keys (DATABASE_URL is set, so it's not missing)
            // REDIS_URL is NOT set, so it should appear
            expect(msg).toContain('REDIS_URL');
            expect(msg).toContain('Redis connection URL');
            // But never includes the actual secret value
            expect(msg).not.toContain('SuperSecret123');
          }
        },
      );
    });

    it('error message names missing secret keys without values', () => {
      withEnv(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          // Intentionally leave OIDC_CLIENT_SECRET and others unset
        },
        () => {
          try {
            loadConfig();
          } catch (error) {
            const msg = (error as Error).message;
            // Names missing secret keys
            expect(msg).toContain('OIDC_CLIENT_SECRET');
            expect(msg).toContain('SESSION_SECRET');
            // Never exposes any value
            expect(msg).not.toContain('SuperSecret');
          }
        },
      );
    });
  });

  describe('secret value redaction', () => {
    it('wraps secret values in Redacted', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'my-oidc-secret',
          SESSION_SECRET: 'my-session-secret',
          STORAGE_ACCESS_KEY_ID: 'my-access-key',
          STORAGE_SECRET_ACCESS_KEY: 'my-secret-key',
        },
        () => {
          const config = loadConfig();
          expect(isRedacted(config.database.url)).toBe(true);
          expect(isRedacted(config.redis.url)).toBe(true);
          expect(isRedacted(config.auth.oidcClientSecret)).toBe(true);
          expect(isRedacted(config.auth.sessionSecret)).toBe(true);
          expect(isRedacted(config.storage.accessKeyId)).toBe(true);
          expect(isRedacted(config.storage.secretAccessKey)).toBe(true);

          // Exposed values contain the actual secret
          expect(config.auth.oidcClientSecret.expose()).toBe('my-oidc-secret');
        },
      );
    });

    it('Redacted.toString() returns [REDACTED]', () => {
      const r = new Redacted('super-secret-123');
      expect(r.toString()).toBe('[REDACTED]');
      expect(String(r)).toBe('[REDACTED]');
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      expect(`${r}`).toBe('[REDACTED]');
    });

    it('Redacted.toJSON() returns [REDACTED]', () => {
      const r = new Redacted('super-secret-123');
      expect(JSON.stringify(r)).toBe('"[REDACTED]"');
      expect(JSON.stringify({ secret: r })).toBe('{"secret":"[REDACTED]"}');
    });

    it('safeStringify redacts all Redacted instances', () => {
      const obj = {
        name: 'test',
        password: new Redacted('hunter2'),
        nested: {
          token: new Redacted('abc123'),
        },
      };
      const result = safeStringify(obj);
      expect(result).toContain('"name":"test"');
      expect(result).toContain('"password":"[REDACTED]"');
      expect(result).toContain('"token":"[REDACTED]"');
      expect(result).not.toContain('hunter2');
      expect(result).not.toContain('abc123');
    });
  });

  describe('safeConfigForLogging', () => {
    it('redacts all secret values', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'secret-oidc',
          SESSION_SECRET: 'secret-session',
          STORAGE_ACCESS_KEY_ID: 'secret-key',
          STORAGE_SECRET_ACCESS_KEY: 'secret-access',
        },
        () => {
          const config = loadConfig();
          const safe = safeConfigForLogging(config);
          const serialized = JSON.stringify(safe);

          // Non-secret values are visible
          expect(serialized).toContain('development');

          // Secret values are redacted
          for (const fieldName of SECRET_FIELD_NAMES) {
            // The value should be [REDACTED], never the actual secret
            if (fieldName === 'DATABASE_URL') {
              const db = safe as { database: { url: string } };
              expect(db.database.url).toBe('[REDACTED]');
            }
          }

          // Actual secrets are never in the output
          expect(serialized).not.toContain('secret-oidc');
          expect(serialized).not.toContain('secret-session');
          expect(serialized).not.toContain('secret-key');
          expect(serialized).not.toContain('secret-access');
        },
      );
    });
  });

  describe('invalid NODE_ENV', () => {
    it('rejects invalid values', () => {
      withEnv({ NODE_ENV: 'invalid' }, () => {
        expect(() => loadConfig()).toThrow(ConfigValidationError);
      });
    });
  });

  describe('model config defaults', () => {
    it('loads model config with defaults', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'secret',
          SESSION_SECRET: 'secret',
          STORAGE_ACCESS_KEY_ID: 'key',
          STORAGE_SECRET_ACCESS_KEY: 'secret',
        },
        () => {
          const config = loadConfig();
          expect(config.model.provider).toBe('fake');
          expect(config.model.name).toBe('fake-v1');
          expect(isRedacted(config.model.apiKey)).toBe(true);
          expect(config.model.maxTokens).toBe(4096);
          expect(config.model.temperature).toBe(0.7);
          expect(config.model.timeoutMs).toBe(30000);
        },
      );
    });

    it('allows overriding model config', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'secret',
          SESSION_SECRET: 'secret',
          STORAGE_ACCESS_KEY_ID: 'key',
          STORAGE_SECRET_ACCESS_KEY: 'secret',
          MODEL_PROVIDER: 'openai',
          MODEL_NAME: 'gpt-4o',
          MODEL_API_KEY: 'sk-test-key',
          MODEL_MAX_TOKENS: '2048',
          MODEL_TEMPERATURE: '0.3',
          MODEL_TIMEOUT_MS: '15000',
        },
        () => {
          const config = loadConfig();
          expect(config.model.provider).toBe('openai');
          expect(config.model.name).toBe('gpt-4o');
          expect(config.model.maxTokens).toBe(2048);
          expect(config.model.temperature).toBe(0.3);
          expect(config.model.timeoutMs).toBe(15000);
        },
      );
    });

    it('model API key is redacted in safeConfigForLogging', () => {
      withEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://localhost/db',
          REDIS_URL: 'redis://localhost:6379',
          OIDC_CLIENT_SECRET: 'secret',
          SESSION_SECRET: 'secret',
          STORAGE_ACCESS_KEY_ID: 'key',
          STORAGE_SECRET_ACCESS_KEY: 'secret',
          MODEL_API_KEY: 'sk-real-secret-key',
        },
        () => {
          const config = loadConfig();
          const safe = safeConfigForLogging(config);
          const serialized = JSON.stringify(safe);
          expect(serialized).not.toContain('sk-real-secret-key');
        },
      );
    });
  });
});
