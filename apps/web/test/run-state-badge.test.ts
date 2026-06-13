// ---------------------------------------------------------------------------
// Run-state badge unit tests (P3-T09)
// ---------------------------------------------------------------------------
// Verifies that all 6 run states produce a visually distinct badge
// (AC #3 — "Cancelled/failed runs are visibly distinct from completed
// answers"). Each state must have a unique CSS class, a non-empty
// human-readable label, and a descriptive ARIA label.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { renderRunStateBadge, type RunState } from '../src/pages/conversation-shared.js';

const ALL_STATES: RunState[] = [
  'CREATED',
  'STREAMING',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'INTERRUPTED',
];

describe('renderRunStateBadge', () => {
  it('produces a `<span>` with `role="status"` for every state', () => {
    for (const s of ALL_STATES) {
      const html = renderRunStateBadge(s);
      expect(html).toMatch(/^<span /);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label=');
    }
  });

  it('uses a unique CSS class per state', () => {
    const classes = new Set<string>();
    for (const s of ALL_STATES) {
      const html = renderRunStateBadge(s);
      const m = html.match(/class="([^"]+)"/);
      expect(m).not.toBeNull();
      classes.add(m![1]!);
    }
    expect(classes.size).toBe(ALL_STATES.length);
  });

  it('uses distinct human-readable labels per state', () => {
    const labels = new Set<string>();
    for (const s of ALL_STATES) {
      const html = renderRunStateBadge(s);
      const m = html.match(/>([A-Za-z]+)<\/span>$/);
      expect(m).not.toBeNull();
      labels.add(m![1]!);
    }
    // All 6 states should have unique visible labels.
    expect(labels.size).toBe(ALL_STATES.length);
  });

  it('uses descriptive ARIA labels (not just the visible text)', () => {
    // AC#3 requires that the cancellation/failure states be
    // distinguishable to assistive technology, not just visually.
    const cancelled = renderRunStateBadge('CANCELLED');
    const failed = renderRunStateBadge('FAILED');
    expect(cancelled).toContain('cancelled');
    expect(failed).toContain('failed');
  });

  it('returns HTML-escaped content (no raw `<` or `>` in the label)', () => {
    // We don't have a state named with HTML, but verify that the
    // renderer never injects raw HTML into the visible label.
    for (const s of ALL_STATES) {
      const html = renderRunStateBadge(s);
      // The visible label is the text between `>` and `</span>`.
      const m = html.match(/>([^<]*)<\/span>$/);
      expect(m).not.toBeNull();
      expect(m![1]!).not.toMatch(/[<>]/);
    }
  });
});
