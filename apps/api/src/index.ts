import { randomBytes } from 'node:crypto';
import { loadConfig, safeConfigForLogging } from '@pia/config';
import { createObservability, runWithCorrelation } from '@pia/observability';
import type { OidcConfig, OidcClient, AuthorizationParams, OidcUserInfo } from '@pia/auth';
import { createPool } from '@pia/db';
import { createServer } from './server.js';

/**
 * Build OIDC configuration from the validated application config.
 *
 * Uses `Redacted.expose()` for secret values — the raw secrets are never
 * printed in logs because `safeConfigForLogging` replaces them with
 * `[REDACTED]` before serialization.
 */
function buildOidcConfig(): OidcConfig {
  const config = loadConfig();

  const sessionSecret = new TextEncoder().encode(config.auth.sessionSecret.expose());
  const clientSecret = config.auth.oidcClientSecret.expose();

  return {
    issuerUrl: config.auth.oidcIssuer,
    clientId: config.auth.oidcClientId,
    clientSecret,
    redirectUri: `${config.server.publicAppUrl}/auth/callback`,
    sessionSecret,
    sessionMaxAgeSeconds: 24 * 3600, // 24 hours
    secureCookies: config.mode === 'production',
  };
}

/**
 * Bypass OIDC client for development — no external provider needed.
 *
 * Instead of redirecting to an external OIDC issuer, returns a URL that
 * points directly to our own `/auth/callback` with a pre-authorized code.
 * On callback, validates the bypass code and returns a hardcoded dev user.
 */
function createDevBypassOidcClient(config: OidcConfig): OidcClient {
  const devSub = 'dev-user-1';
  const devEmail = 'dev@localhost';

  return {
    getIssuerUrl: () => config.issuerUrl,

    getAuthorizationUrl: async (): Promise<AuthorizationParams> => {
      const state = randomBytes(16).toString('hex');
      const codeVerifier = randomBytes(32).toString('base64url');
      const nonce = randomBytes(16).toString('hex');

      const authorizationUrl = `${config.redirectUri}?code=DEV-BYPASS&state=${encodeURIComponent(state)}`;

      return { authorizationUrl, codeVerifier, state, nonce };
    },

    handleCallback: async (code: string): Promise<OidcUserInfo> => {
      if (code !== 'DEV-BYPASS') {
        throw new Error('Invalid dev bypass code');
      }
      return {
        sub: devSub,
        email: devEmail,
        email_verified: true,
        name: 'Dev User',
        preferred_username: 'dev',
        picture: undefined,
      };
    },
  };
}

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const oidcConfig = buildOidcConfig();
    const dbPool = createPool();
    const oidcClient = createDevBypassOidcClient(oidcConfig);
    const observability = createObservability({
      enabled: true,
      logLevel: config.logging.level,
      logFormat: config.logging.format,
    });

    runWithCorrelation(() => {
      observability.logger.info('API server initializing', {
        mode: config.mode,
        config: safeConfigForLogging(config),
        oidcIssuer: oidcConfig.issuerUrl,
      });
    });

    const app = await createServer({ oidcConfig, mode: config.mode, dbPool, oidcClient });

    // Start listening
    const port = config.server.port;
    const host = config.server.host;

    await app.listen({ port, host });

    runWithCorrelation(() => {
      observability.logger.info('API server listening', {
        host,
        port,
        mode: config.mode,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      runWithCorrelation(() => {
        observability.logger.info('API server shutting down', { signal });
      });
      await dbPool.end();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    // eslint-disable-next-line no-console -- logging unavailable at startup failure
    console.error('Failed to start API server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
