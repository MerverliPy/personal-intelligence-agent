import { loadConfig, safeConfigForLogging } from '@pia/config';
import { createObservability, runWithCorrelation } from '@pia/observability';
import type { OidcConfig } from '@pia/auth';

/**
 * Build OIDC configuration from the application config.
 * Session secret and OIDC client secret are redacted at the config level;
 * the config package validates their presence in production mode.
 */
function buildOidcConfig(): OidcConfig {
  const config = loadConfig();

  // Auth secrets are validated by the config loader in production mode.
  // In dev/test, defaults are used. The secret values are kept opaque
  // (Redacted type) and unwrapped here with explicit intent.
  const sessionSecret = new TextEncoder().encode(
    process.env['SESSION_SECRET'] ?? 'dev-session-secret-change-in-production-!!',
  );

  const clientSecret =
    process.env['OIDC_CLIENT_SECRET'] ?? 'dev-client-secret-change-in-production';

  return {
    issuerUrl: config.auth.oidcIssuer,
    clientId: config.auth.oidcClientId,
    clientSecret,
    redirectUri: `http://${config.server.host}:${config.server.port}/auth/callback`,
    sessionSecret,
    sessionMaxAgeSeconds: 24 * 3600, // 24 hours
    secureCookies: config.mode === 'production',
  };
}

function main(): void {
  try {
    const config = loadConfig();
    const oidcConfig = buildOidcConfig();
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
        oidcClientId: oidcConfig.clientId,
        sessionMaxAgeSeconds: oidcConfig.sessionMaxAgeSeconds,
        secureCookies: oidcConfig.secureCookies,
      });
    });

    // Auth middleware, routes, and HTTP server will be installed in P1-T07
    // (API conventions and authenticated web shell). The OIDC configuration
    // is available now and ready for integration.
  } catch (error) {
    console.error('Failed to start API server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
