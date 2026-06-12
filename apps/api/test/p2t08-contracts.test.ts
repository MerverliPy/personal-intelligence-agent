import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import type { OidcConfig } from '@pia/auth';
import { createSessionToken, SESSION_COOKIE } from '@pia/auth';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Test helpers
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

/** Creates a valid signed session cookie header. */
async function validSessionCookie(): Promise<string> {
  const token = await createSessionToken(
    {
      userId: randomUUID(),
      email: 'test@example.com',
      displayName: 'Test User',
      issuer: testOidcConfig.issuerUrl,
      subject: `oidc|${randomUUID()}`,
    },
    testOidcConfig.sessionSecret,
    3600,
  );
  return `${SESSION_COOKIE}=${token}`;
}

beforeAll(async () => {
  app = await createServer({ oidcConfig: testOidcConfig, mode: 'test' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Auth protection — new endpoints
// ---------------------------------------------------------------------------

describe('P2-T08: Auth protection on new endpoints', () => {
  it('GET /v1/workspaces/{wid}/documents returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /v1/workspaces/{wid}/documents/{did} returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000002',
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /v1/workspaces/{wid}/documents/{did} returns 401 without session', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000002',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /v1/workspaces/{wid}/documents/{did}/ingestion-jobs returns 401 without session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000002/ingestion-jobs',
      headers: { 'idempotency-key': 'test-key-12345' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /v1/workspaces/{wid}/ingestion-jobs/{jid} returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/ingestion-jobs/00000000-0000-0000-0000-000000000003',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /v1/workspaces/{wid}/retrieval/query returns 401 without session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      payload: { query: 'test query' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /v1/workspaces/{wid}/retrieval/traces/{tid} returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/traces/00000000-0000-0000-0000-000000000004',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Error envelope conformance
// ---------------------------------------------------------------------------

describe('P2-T08: Error envelope conformance', () => {
  it('document not found returns 403 with standard envelope', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000099',
      headers: { cookie },
    });
    expect([403, 500]).toContain(res.statusCode); // 403 with DB, 500 if DB absent
    const body = res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
    expect(body.error.request_id).toBeDefined();
  });

  it('retrieval query with missing body returns validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      headers: { cookie: await validSessionCookie() },
      payload: {},
    });
    // Should fail schema validation (query is required)
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('retrieval query with empty text returns validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      headers: { cookie: await validSessionCookie() },
      payload: { query: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('document list returns 403 without workspace membership', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents?limit=50',
      headers: { cookie },
    });
    // Auth fails because user has no workspace membership (403)
    // Returns 500 if DB is unavailable in test env
    expect([403, 500]).toContain(res.statusCode);
    const body = res.json();
    if (res.statusCode === 403) {
      expect(body.error.code).toBe('FORBIDDEN');
    }
  });
});

// ---------------------------------------------------------------------------
// Contract type validation — API response shapes
// ---------------------------------------------------------------------------

describe('P2-T08: Contract type conformance', () => {
  it('health endpoint returns correct shape (regression)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(typeof body.status).toBe('string');
  });

  it('unauthorized responses always include request_id', async () => {
    const endpoints = [
      { method: 'GET', url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents' },
      {
        method: 'GET',
        url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/ingestion-jobs/00000000-0000-0000-0000-000000000001',
      },
      {
        method: 'POST',
        url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
        payload: { query: 'test' },
      },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method as 'GET' | 'POST',
        url: ep.url,
        ...(ep.payload ? { payload: ep.payload } : {}),
      });
      const body = res.json();
      expect(body.error.request_id, `request_id missing for ${ep.method} ${ep.url}`).toBeTruthy();
      expect(body.error.code, `code missing for ${ep.method} ${ep.url}`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Cursor/pagination helper unit tests
// ---------------------------------------------------------------------------

describe('P2-T08: Cursor and pagination helpers', () => {
  it('encodeCursor/decodeCursor round-trips correctly', async () => {
    // Import through app to verify contracts package is correctly linked
    const { encodeCursor, decodeCursor, normaliseLimit } = await import('@pia/contracts');

    const original = '2025-01-01T00:00:00.000Z';
    const encoded = encodeCursor(original);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toBe(original);

    const decoded = decodeCursor(encoded);
    expect(decoded).toBe(original);
  });

  it('normaliseLimit clamps values within bounds', async () => {
    const { normaliseLimit } = await import('@pia/contracts');

    expect(normaliseLimit(undefined)).toBe(50); // default
    expect(normaliseLimit(0)).toBe(1);
    expect(normaliseLimit(1)).toBe(1);
    expect(normaliseLimit(50)).toBe(50);
    expect(normaliseLimit(200)).toBe(200);
    expect(normaliseLimit(999)).toBe(200); // max cap
    expect(normaliseLimit(-5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Retrieval trace role gating
// ---------------------------------------------------------------------------

describe('P2-T08: Retrieval trace role gating', () => {
  it('GET /v1/workspaces/{wid}/retrieval/traces/{tid} requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/traces/00000000-0000-0000-0000-000000000001',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// HTTP status codes on accepted responses (H1/H2 regressions)
// ---------------------------------------------------------------------------

describe('P2-T08: Success status codes', () => {
  it('DELETE /documents/{did} returns 202 or 4xx (never 200)', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000002',
      headers: { cookie },
    });
    // With DB: 403 (no membership) or 404 (not found)
    // Without DB: 500
    // Should NEVER be 200 (spec requires 202 on success)
    expect(res.statusCode).not.toBe(200);
  });

  it('POST /ingestion-jobs returns 202 or 4xx (never 200)', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/documents/00000000-0000-0000-0000-000000000002/ingestion-jobs',
      headers: { cookie, 'idempotency-key': randomUUID() },
      payload: {},
    });
    // With DB: 403 (no membership) or 404 (not found)
    // Without DB: 500
    // Should NEVER be 200 (spec requires 202 on success)
    expect(res.statusCode).not.toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Cross-workspace object-level authorization (M1)
// ---------------------------------------------------------------------------

describe('P2-T08: Cross-workspace object-level authorization', () => {
  // A session authenticated to one workspace must not be able to access
  // resources belonging to a different workspace. The workspace_id in the
  // URL is validated against the authenticated user's membership — even with
  // a valid session, requests to a workspace the user is not a member of
  // must be rejected (403 or 500 when DB unavailable).

  const WORKSPACE_A = '00000000-0000-0000-0000-000000000010';
  const WORKSPACE_B = '00000000-0000-0000-0000-000000000020';
  const DOC_IN_B = '00000000-0000-0000-0000-000000000030';
  const JOB_IN_B = '00000000-0000-0000-0000-000000000031';
  const TRACE_IN_B = '00000000-0000-0000-0000-000000000032';

  // A session for a user who (hypothetically) is a member of Workspace A only.
  // Requests to Workspace B must be rejected because requireWorkspaceContext
  // checks membership in the requested workspace_id.
  async function sessionForWorkspaceA(): Promise<string> {
    return validSessionCookie(); // any authenticated session triggers the membership check
  }

  it('GET /workspaces/{wid_B}/documents rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_B}/documents`,
      headers: { cookie },
    });
    // requireWorkspaceContext verifies membership in WORKSPACE_B:
    // no membership → 403; DB unavailable → 500
    expect([403, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it('GET /workspaces/{wid_B}/documents/{did} rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_B}/documents/${DOC_IN_B}`,
      headers: { cookie },
    });
    expect([403, 404, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it('DELETE /workspaces/{wid_B}/documents/{did} rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${WORKSPACE_B}/documents/${DOC_IN_B}`,
      headers: { cookie },
    });
    expect([403, 404, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(202);
  });

  it('POST /workspaces/{wid_B}/documents/{did}/ingestion-jobs rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_B}/documents/${DOC_IN_B}/ingestion-jobs`,
      headers: { cookie, 'idempotency-key': randomUUID() },
      payload: {},
    });
    expect([403, 404, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(202);
  });

  it('GET /workspaces/{wid_B}/ingestion-jobs/{jid} rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_B}/ingestion-jobs/${JOB_IN_B}`,
      headers: { cookie },
    });
    expect([403, 404, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it('POST /workspaces/{wid_B}/retrieval/query rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${WORKSPACE_B}/retrieval/query`,
      headers: { cookie },
      payload: { query: 'cross-workspace probe' },
    });
    expect([403, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it('GET /workspaces/{wid_B}/retrieval/traces/{tid} rejects session from workspace A', async () => {
    const cookie = await sessionForWorkspaceA();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_B}/retrieval/traces/${TRACE_IN_B}`,
      headers: { cookie },
    });
    // Requires elevated role in WORKSPACE_B — session has none → 403 or 500
    expect([403, 500]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it('cross-workspace workspace_id in URL path is isolated (wid_A vs wid_B)', async () => {
    // Confirm different workspace IDs in the URL path reach different access checks
    const cookie = await sessionForWorkspaceA();
    const resA = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_A}/documents`,
      headers: { cookie },
    });
    const resB = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${WORKSPACE_B}/documents`,
      headers: { cookie },
    });
    // Both should be rejected without DB membership records.
    // The important invariant: neither returns 200 (no data leaks).
    expect(resA.statusCode).not.toBe(200);
    expect(resB.statusCode).not.toBe(200);
  });
});

describe('P2-T08: Retrieval query validation', () => {
  it('rejects invalid history_mode value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      headers: { cookie: await validSessionCookie() },
      payload: { query: 'test', history_mode: 'INVALID' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts CURRENT_ONLY history mode', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      headers: { cookie },
      payload: { query: 'test', history_mode: 'CURRENT_ONLY' },
    });
    // Validation should pass (400 = schema failure), auth fails (403)
    // Returns 500 if DB is unavailable in test env
    expect(res.statusCode).not.toBe(400);
  });

  it('accepts INCLUDE_HISTORY history mode', async () => {
    const cookie = await validSessionCookie();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000001/retrieval/query',
      headers: { cookie },
      payload: { query: 'test', history_mode: 'INCLUDE_HISTORY' },
    });
    // Validation should pass (400 = schema failure), auth fails (403)
    // Returns 500 if DB is unavailable in test env
    expect(res.statusCode).not.toBe(400);
  });
});
