import { randomBytes } from 'node:crypto';
import type { AppMode } from '@pia/config';
import {
  createRealOidcClient,
  type AuthorizationParams,
  type OidcClient,
  type OidcConfig,
  type OidcUserInfo,
} from '@pia/auth';

/**
 * Development-only OIDC bypass.
 *
 * This client must never be selected in production. Selection is controlled
 * exclusively by selectOidcClient().
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

      const authorizationUrl =
        `${config.redirectUri}?code=DEV-BYPASS&state=${encodeURIComponent(state)}`;

      return {
        authorizationUrl,
        codeVerifier,
        state,
        nonce,
      };
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

export interface OidcClientFactories {
  readonly createReal: (config: OidcConfig) => OidcClient;
  readonly createDevBypass: (config: OidcConfig) => OidcClient;
}

export interface SelectOidcClientOptions {
  readonly mode: AppMode;
  readonly bypassRequested: boolean;
  readonly config: OidcConfig;
  readonly factories?: OidcClientFactories;
}

const DEFAULT_FACTORIES: OidcClientFactories = {
  createReal: createRealOidcClient,
  createDevBypass: createDevBypassOidcClient,
};

/**
 * Selects the OIDC client for the current application mode.
 *
 * Security invariant:
 * A development bypass request in production is rejected before either client
 * factory is invoked.
 */
export function selectOidcClient(options: SelectOidcClientOptions): OidcClient {
  const factories = options.factories ?? DEFAULT_FACTORIES;

  if (options.mode === 'production' && options.bypassRequested) {
    throw new Error('PIA_ALLOW_DEV_AUTH_BYPASS is forbidden in production');
  }

  if (options.mode !== 'production' && options.bypassRequested) {
    return factories.createDevBypass(options.config);
  }

  return factories.createReal(options.config);
}
