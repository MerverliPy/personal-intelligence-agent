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
// Page existence and accessibility
// ---------------------------------------------------------------------------

describe('P2-T09: Web page serving', () => {
  const WID = '00000000-0000-0000-0000-000000000001';
  const DID = '00000000-0000-0000-0000-000000000002';

  it('GET /app/workspaces/{wid}/documents returns HTML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('Documents');
  });

  it('GET /app/workspaces/{wid}/documents/{did} returns HTML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents/${DID}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('Document Detail');
  });

  it('GET /app/workspaces/{wid}/upload returns HTML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/upload`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('Upload');
  });

  it('GET /app/workspaces/{wid}/search returns HTML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('Search');
  });

  it('web pages do not require authentication (pages load, API calls validate)', async () => {
    const pages = [
      `/app/workspaces/${WID}/documents`,
      `/app/workspaces/${WID}/upload`,
      `/app/workspaces/${WID}/search`,
    ];
    for (const p of pages) {
      const res = await app.inject({ method: 'GET', url: p });
      expect(res.statusCode, `Page ${p} should be accessible`).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Accessibility checks
// ---------------------------------------------------------------------------

describe('P2-T09: Accessibility features', () => {
  const WID = '00000000-0000-0000-0000-000000000001';
  const DID = '00000000-0000-0000-0000-000000000002';

  it('document list page includes ARIA table role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents`,
    });
    expect(res.body).toMatch(/role="table"/);
    expect(res.body).toMatch(/aria-label="Documents"/);
  });

  it('search page includes ARIA search role and live region', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    expect(res.body).toMatch(/role="search"/);
    expect(res.body).toMatch(/aria-live="polite"/);
    expect(res.body).toMatch(/aria-atomic/);
  });

  it('upload page includes keyboard-support code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/upload`,
    });
    expect(res.body).toMatch(/keydown/);
    expect(res.body).toMatch(/Enter/);
  });

  it('all pages include sr-only class for screen readers', async () => {
    const pages = [
      `/app/workspaces/${WID}/documents`,
      `/app/workspaces/${WID}/documents/${DID}`,
      `/app/workspaces/${WID}/upload`,
      `/app/workspaces/${WID}/search`,
    ];
    for (const p of pages) {
      const res = await app.inject({ method: 'GET', url: p });
      expect(res.body, `Page ${p} should have sr-only`).toMatch(/sr-only/);
    }
  });

  it('search page includes keyboard shortcut for focusing search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    expect(res.body).toMatch(/query-input/);
    expect(res.body).toMatch(/focus\(\)/);
  });

  it('document list page includes keyboard-navigable rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents`,
    });
    expect(res.body).toMatch(/tabindex="0"/);
    expect(res.body).toMatch(/role="row"/);
  });
});

// ---------------------------------------------------------------------------
// Page content structure
// ---------------------------------------------------------------------------

describe('P2-T09: Page content structure', () => {
  const WID = '00000000-0000-0000-0000-000000000001';
  const DID = '00000000-0000-0000-0000-000000000002';

  it('document list page has upload link and search tab', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents`,
    });
    // PIA-MUR-D-004-IMPL commit 3: document list page has an "Upload"
    // CTA in the page body (the FAB that opens the upload sheet is
    // added in commit 7) and a Search tab in the bottom tab bar.
    expect(res.body).toContain('Upload');
    expect(res.body).toContain('/upload'); // legacy href in the page body
    expect(res.body).toContain('Search');
    expect(res.body).toContain('data-tab="search"'); // new bottom-tab-bar data attribute
  });

  it('document detail page has retry and delete controls', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents/${DID}`,
    });
    expect(res.body).toMatch(/Retry|retry|retry-btn/);
    expect(res.body).toMatch(/Delete|delete|delete-btn/);
    expect(res.body).toContain('Ingestion Jobs');
  });

  it('upload page has file input and form', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/upload`,
    });
    expect(res.body).toMatch(/type="file"/);
    expect(res.body).toMatch(/accept=".*pdf.*docx.*txt/);
    expect(res.body).toMatch(/progress/);
  });

  it('search page has query input and options', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    expect(res.body).toMatch(/type="search"/);
    expect(res.body).toContain('include-history');
    expect(res.body).toContain('result-limit');
    expect(res.body).toContain('INCLUDE_HISTORY');
    expect(res.body).toContain('CURRENT_ONLY');
  });

  it('search page results template includes source/version/locator', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    // The template JS code should include these display fields
    expect(res.body).toContain('source_id');
    expect(res.body).toContain('document_version_id');
    expect(res.body).toContain('locator');
    expect(res.body).toContain('chunk_id');
  });

  it('all pages include error container for actionable failure display', async () => {
    const pages = [
      `/app/workspaces/${WID}/documents`,
      `/app/workspaces/${WID}/documents/${DID}`,
      `/app/workspaces/${WID}/upload`,
      `/app/workspaces/${WID}/search`,
    ];
    for (const p of pages) {
      const res = await app.inject({ method: 'GET', url: p });
      expect(res.body, `Page ${p} should have error-container`).toContain('error-container');
    }
  });
});

// ---------------------------------------------------------------------------
// Tab navigation and layout
// ---------------------------------------------------------------------------

describe('P2-T09: Tab navigation', () => {
  const WID = '00000000-0000-0000-0000-000000000001';

  it('document list page has active documents tab', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/documents`,
    });
    // PIA-MUR-D-004-IMPL commit 3: bottom tab bar uses
    // aria-current="page" instead of class="active".
    expect(res.body).toMatch(/aria-current="page"[\s\S]*?Documents/);
  });

  it('upload page highlights Documents tab (Upload is a sub-page)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/upload`,
    });
    // Upload is a sub-page of Documents (the FAB on the Documents
    // tab opens the upload sheet). The bottom tab bar shows Documents
    // as active, not Upload (there is no Upload tab in the
    // mobile-first 3-tab bar).
    expect(res.body).toMatch(/aria-current="page"[\s\S]*?Documents/);
  });

  it('search page has active search tab', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/app/workspaces/${WID}/search`,
    });
    expect(res.body).toMatch(/aria-current="page"[\s\S]*?Search/);
  });

  it('tab bar uses navigation ARIA role', async () => {
    const pages = [
      `/app/workspaces/${WID}/documents`,
      `/app/workspaces/${WID}/upload`,
      `/app/workspaces/${WID}/search`,
    ];
    for (const p of pages) {
      const res = await app.inject({ method: 'GET', url: p });
      expect(res.body, `Page ${p} should have tab navigation`).toMatch(/role="navigation"/);
    }
  });
});
