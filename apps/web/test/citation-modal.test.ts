// ---------------------------------------------------------------------------
// Citation modal unit tests (P3-T09)
// ---------------------------------------------------------------------------
// Covers XSS-safe rendering of citation fields, the no-fetch guarantee
// (the modal must render synchronously from the in-memory citation),
// and keyboard-activatable chips.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  renderCitationChip,
  renderCitationModalBody,
  type CitationView,
} from '../src/pages/conversation-shared.js';

const SAMPLE_CITATION: CitationView = {
  id: 'cit-1',
  chunk_id: 'chunk-1',
  document_version_id: 'doc-v-42',
  source_locator: { page: 7 },
  claim_text: 'The sky is blue.',
  claim_start: 10,
  claim_end: 26,
  verification_status: 'VERIFIED',
};

describe('renderCitationChip', () => {
  it('renders a `<button>` with `aria-haspopup="dialog"`', () => {
    const html = renderCitationChip(SAMPLE_CITATION, 0);
    expect(html).toMatch(/^<button /);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('includes the citation ID in a data attribute', () => {
    const html = renderCitationChip(SAMPLE_CITATION, 0);
    expect(html).toContain('data-citation-id="cit-1"');
  });

  it('uses the 1-based index in the visible label', () => {
    expect(renderCitationChip(SAMPLE_CITATION, 0)).toContain('[1]');
    expect(renderCitationChip(SAMPLE_CITATION, 4)).toContain('[5]');
  });

  it('truncates long claim text in the ARIA label', () => {
    const long: CitationView = {
      ...SAMPLE_CITATION,
      claim_text: 'a'.repeat(500),
    };
    const html = renderCitationChip(long, 0);
    // The ARIA label should be present and bounded.
    const m = html.match(/aria-label="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]!.length).toBeLessThan(150);
  });
});

describe('renderCitationModalBody', () => {
  it('renders source/version/locator/verification_status and claim text', () => {
    const html = renderCitationModalBody(SAMPLE_CITATION);
    expect(html).toContain('doc-v-42');
    expect(html).toContain('page 7');
    expect(html).toContain('VERIFIED');
    expect(html).toContain('The sky is blue.');
  });

  it('XSS guard: escapes script tags in claim_text', () => {
    const xss: CitationView = {
      ...SAMPLE_CITATION,
      claim_text: '<script>alert("xss")</script>',
    };
    const html = renderCitationModalBody(xss);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('XSS guard: escapes ampersands and quotes in document_version_id', () => {
    const xss: CitationView = {
      ...SAMPLE_CITATION,
      document_version_id: 'a"&b<c>',
    };
    const html = renderCitationModalBody(xss);
    expect(html).toContain('&quot;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('formats `page` locator as `page N`', () => {
    const html = renderCitationModalBody(SAMPLE_CITATION);
    expect(html).toContain('page 7');
  });

  it('formats `ordinal` locator as `type N`', () => {
    const c: CitationView = {
      ...SAMPLE_CITATION,
      source_locator: { type: 'page', ordinal: 12 },
    };
    const html = renderCitationModalBody(c);
    expect(html).toContain('page 12');
  });

  it('falls back to JSON.stringify for unknown locator shapes', () => {
    const c: CitationView = {
      ...SAMPLE_CITATION,
      source_locator: { custom: { nested: 'value' } },
    };
    const html = renderCitationModalBody(c);
    expect(html).toContain('&quot;custom&quot;');
  });

  it('NO-FETCH GUARANTEE: returns synchronously, never calls fetch', () => {
    // This is the AC#2 risk mitigation: the modal renders from the
    // in-memory citation, not from a network call. Verify by
    // stubbing `globalThis.fetch` and asserting it is never called.
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    let fetchCalled = false;
    (globalThis as { fetch?: unknown }).fetch = () => {
      fetchCalled = true;
      throw new Error('fetch must not be called from renderCitationModalBody');
    };
    try {
      const html = renderCitationModalBody(SAMPLE_CITATION);
      expect(typeof html).toBe('string');
      expect(fetchCalled).toBe(false);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });
});
