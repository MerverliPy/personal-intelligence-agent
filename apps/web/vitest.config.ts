import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the @pia/web package.
 *
 * Uses `jsdom` so the unit tests can exercise DOM APIs (the SSE parser,
 * the citation modal renderer, the run-state badge, the feedback form,
 * and the static a11y checks all rely on the DOM being available).
 *
 * NOTE: Full WCAG 2.2 AA validation is deferred to a follow-up task
 * that will add `axe-core` and a Playwright-based browser harness.
 * See `test/a11y-static.test.ts` for the static-coverage TODOs.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
