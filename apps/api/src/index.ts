import { loadConfig, safeConfigForLogging } from '@pia/config';
import { createObservability, runWithCorrelation } from '@pia/observability';
import type { OidcConfig } from '@pia/auth';
import { createPool } from '@pia/db';
import { createServer } from './server.js';
import { selectOidcClient } from './oidc-client-selection.js';

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

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const oidcConfig = buildOidcConfig();
    const dbPool = createPool();
    const oidcClient = selectOidcClient({
      mode: config.mode,
      bypassRequested: process.env['PIA_ALLOW_DEV_AUTH_BYPASS'] === '1',
      config: oidcConfig,
    });
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
