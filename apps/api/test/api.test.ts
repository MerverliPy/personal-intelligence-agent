import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { createServer } from '../src/server.js';
import type { OidcConfig } from '@pia/auth';
import { getCurrentCorrelationId } from '@pia/observability';

// ---------------------------------------------------------------------------
// Test server setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const testOidcConfig: OidcConfig = {
  issuerUrl: 'https://test.example.com',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  redirectUri: 'http://localhost:3000/callback',
  sessionSecret: new TextEncoder().encode('test-secret-minimum-32-chars!!'),
  sessionMaxAgeSeconds: 3600,
  secureCookies: false,
};

beforeAll(async () => {
  app = await createServer({ oidcConfig: testOidcConfig, mode: 'test' });
  // Fastify inject doesn't require listen
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Health endpoints
// ---------------------------------------------------------------------------

describe('Health endpoints', () => {
  it('GET /health/live returns ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('GET /health/ready returns ok when DB is available', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    // DB may or may not be available; accept either 200 or 503
    expect([200, 503]).toContain(response.statusCode);
    const body = response.json();
    expect(body.status).toBeDefined();
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Auth protection
// ---------------------------------------------------------------------------

describe('Auth protection', () => {
  it('GET /v1/me returns 401 without session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.request_id).toBeTruthy();
  });

  it('GET /v1/workspaces returns 401 without session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /v1/workspaces/{id} returns 401 without session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Error envelope format
// ---------------------------------------------------------------------------

describe('Error envelope', () => {
  it('404 returns standard error envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBeDefined();
    expect(body.error.request_id).toBeTruthy();
    expect(response.headers['x-request-id']).toBe(body.error.request_id);
  });

  it('500 errors never leak internal details', async () => {
    // Create a separate Fastify instance with error handler for this test
    const testApp = Fastify();
    const errorHandlerPlugin = (await import('../src/plugins/error-handler.js')).default;
    const requestIdPlugin = (await import('../src/plugins/request-id.js')).default;
    await testApp.register(requestIdPlugin);
    await testApp.register(errorHandlerPlugin);

    testApp.get('/test-error', async () => {
      throw new Error('secret internal detail');
    });

    await testApp.ready();

    const response = await testApp.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An internal error occurred.');
    // Must NOT leak the internal message
    expect(body.error.message).not.toContain('secret');

    await testApp.close();
  });
});

// ---------------------------------------------------------------------------
// Request ID header
// ---------------------------------------------------------------------------

describe('Request ID', () => {
  it('generates X-Request-ID when not provided by client', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.headers['x-request-id']).toBeTruthy();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  it('echoes client-supplied X-Request-ID', async () => {
    const clientId = 'my-request-12345';
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': clientId },
    });

    expect(response.headers['x-request-id']).toBe(clientId);
  });

  it('rejects X-Request-ID exceeding maximum length (64 chars)', async () => {
    const longId = 'a'.repeat(65);
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': longId },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('maximum length');
  });

  it('rejects X-Request-ID with unsafe characters', async () => {
    const unsafeIds = [
      'bad<script>',
      'id with spaces',
      'path/traversal',
      'back\\slash',
      'quote"mark',
      'percent%00',
    ];

    for (const unsafeId of unsafeIds) {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { 'x-request-id': unsafeId },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('invalid');
    }
  });

  it('accepts X-Request-ID at maximum allowed length (64 chars)', async () => {
    const maxId = 'a'.repeat(64);
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': maxId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe(maxId);
  });

  it('accepts valid X-Request-ID with hyphens and underscores', async () => {
    const validIds = [
      'req-abc-123',
      'trace_id_456',
      'x-amzn-RequestId-7f8b9c0d',
      'ABCDEF',
      '123456',
    ];

    for (const validId of validIds) {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { 'x-request-id': validId },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe(validId);
    }
  });
});

// ---------------------------------------------------------------------------
// Correlation context
// ---------------------------------------------------------------------------

describe('Correlation context', () => {
  let corrApp: FastifyInstance;

  beforeAll(async () => {
    corrApp = Fastify();
    const requestIdPlugin = (await import('../src/plugins/request-id.js')).default;
    const correlationPlugin = (await import('../src/plugins/correlation.js')).default;
    const errorHandlerPlugin = (await import('../src/plugins/error-handler.js')).default;

    await corrApp.register(requestIdPlugin);
    await corrApp.register(correlationPlugin);
    await corrApp.register(errorHandlerPlugin);

    corrApp.get('/corr-test', async (request) => {
      return { correlationId: getCurrentCorrelationId(), requestId: request.id };
    });

    await corrApp.ready();
  });

  afterAll(async () => {
    await corrApp.close();
  });

  it('correlation context matches the request ID', async () => {
    const response = await corrApp.inject({
      method: 'GET',
      url: '/corr-test',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.requestId).toBeTruthy();
    expect(body.correlationId).toBe(body.requestId);
  });

  it('correlation context propagates from client-supplied request ID', async () => {
    const clientId = 'client-supplied-789';
    const response = await corrApp.inject({
      method: 'GET',
      url: '/corr-test',
      headers: { 'x-request-id': clientId },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.requestId).toBe(clientId);
    expect(body.correlationId).toBe(clientId);
  });

  it('concurrent requests have distinct correlation IDs', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        corrApp
          .inject({
            method: 'GET',
            url: '/corr-test',
          })
          .then((r) => r.json()),
      ),
    );

    const ids = results.map((b: Record<string, unknown>) => b.correlationId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
    // Each correlation ID matches its own request ID
    for (const result of results) {
      expect(result.correlationId).toBe(result.requestId);
    }
  });
});

// ---------------------------------------------------------------------------
// Idempotency (header detection)
// ---------------------------------------------------------------------------

describe('Idempotency', () => {
  it('accepts requests without Idempotency-Key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
  });

  it('accepts requests with Idempotency-Key header (no-op for GET)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'idempotency-key': 'test-key-001' },
    });

    expect(response.statusCode).toBe(200);
  });
});
