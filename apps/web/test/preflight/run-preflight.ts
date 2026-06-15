/**
 * Pre-flight run entry point for PIA mobile UI redesign.
 *
 * This is invoked by `pnpm preflight:device` at the repo root.
 * It runs the per-DPC spec files in `specs/` and emits evidence
 * to `.ui-redesign/evidence/preflight/`.
 *
 * Per-DPC spec files are authored by three specialists:
 *   - real-ui-product-tester:    DPC-1, 3, 4, 5, 14 (Playwright e2e + screenshot diff)
 *   - accessibility-performance-validator: DPC-7, 8, 9, 10 (axe-core + ARIA + WCAG 2.2 AA)
 *   - iphone-interaction-specialist:       DPC-6, 12, 13 (iOS-specific)
 *
 * DPC-2 is BLOCKED (requires authenticated session; deferred to implementation-contract).
 * DPC-11 is PARTIALLY_VERIFIED (the harness confirms matchMedia('display-mode: standalone')
 * works in iOS UA; the actual install still requires a real iPhone).
 *
 * Decision: PIA-MUR-D-016 (approved 2026-06-14)
 * Install:   PIA-MUR-D-017 (open; required before this script will run successfully)
 */
import { defineConfig } from '@playwright/test';

const baseConfig = (await import('./playwright.config.js')).default;

export default defineConfig({
  ...baseConfig,
  testDir: './specs',
  reporter: [
    ...(baseConfig.reporter ?? []),
    ['./run-preflight-reporter.ts'],
  ],
});
