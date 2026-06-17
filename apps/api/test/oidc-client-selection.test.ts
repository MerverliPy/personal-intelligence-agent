import { describe, expect, it, vi } from 'vitest';
import type { AppMode } from '@pia/config';
import type { OidcClient, OidcConfig } from '@pia/auth';
import {
  selectOidcClient,
  type OidcClientFactories,
} from '../src/oidc-client-selection.js';

const oidcConfig: OidcConfig = {
  issuerUrl: 'https://issuer.example.test',
  clientId: 'test-client',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/auth/callback',
  sessionSecret: new TextEncoder().encode(
    'test-session-secret-at-least-32-characters',
  ),
  sessionMaxAgeSeconds: 3600,
  secureCookies: false,
};

function makeClient(label: string): OidcClient {
  return {
    getIssuerUrl: () => label,

    getAuthorizationUrl: async () => ({
      authorizationUrl: `https://${label}.example.test/authorize`,
      codeVerifier: 'test-verifier',
      state: 'test-state',
      nonce: 'test-nonce',
    }),

    handleCallback: async (
      _code: string,
      _state: string,
      _codeVerifier: string,
      _nonce: string,
    ) => ({
      sub: `${label}-subject`,
      email: `${label}@example.test`,
      email_verified: true,
      name: label,
      preferred_username: label,
      picture: undefined,
    }),
  };
}

function createTestFactories() {
  const realClient = makeClient('real');
  const devClient = makeClient('development-bypass');

  const createReal = vi.fn((_config: OidcConfig) => realClient);
  const createDevBypass = vi.fn((_config: OidcConfig) => devClient);

  const factories: OidcClientFactories = {
    createReal,
    createDevBypass,
  };

  return {
    factories,
    realClient,
    devClient,
    createReal,
    createDevBypass,
  };
}

describe('selectOidcClient', () => {
  it('rejects a development bypass request in production before invoking a factory', () => {
    const test = createTestFactories();

    expect(() =>
      selectOidcClient({
        mode: 'production',
        bypassRequested: true,
        config: oidcConfig,
        factories: test.factories,
      }),
    ).toThrow('PIA_ALLOW_DEV_AUTH_BYPASS is forbidden in production');

    expect(test.createReal).not.toHaveBeenCalled();
    expect(test.createDevBypass).not.toHaveBeenCalled();
  });

  const realClientCases = [
    ['production', false],
    ['development', false],
    ['test', false],
  ] as const satisfies ReadonlyArray<readonly [AppMode, boolean]>;

  it.each(realClientCases)(
    'uses the real OIDC client in %s mode when bypassRequested=%s',
    (mode, bypassRequested) => {
      const test = createTestFactories();

      const client = selectOidcClient({
        mode,
        bypassRequested,
        config: oidcConfig,
        factories: test.factories,
      });

      expect(client).toBe(test.realClient);
      expect(test.createReal).toHaveBeenCalledOnce();
      expect(test.createReal).toHaveBeenCalledWith(oidcConfig);
      expect(test.createDevBypass).not.toHaveBeenCalled();
    },
  );

  const bypassCases = [
    ['development', true],
    ['test', true],
  ] as const satisfies ReadonlyArray<readonly [AppMode, boolean]>;

  it.each(bypassCases)(
    'uses the development bypass in %s mode when explicitly requested',
    (mode, bypassRequested) => {
      const test = createTestFactories();

      const client = selectOidcClient({
        mode,
        bypassRequested,
        config: oidcConfig,
        factories: test.factories,
      });

      expect(client).toBe(test.devClient);
      expect(test.createDevBypass).toHaveBeenCalledOnce();
      expect(test.createDevBypass).toHaveBeenCalledWith(oidcConfig);
      expect(test.createReal).not.toHaveBeenCalled();
    },
  );
});
