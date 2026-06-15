/**
 * Shared helpers for the PIA mobile UI pre-flight spec files.
 *
 * Import via:
 *   import { test, expect, PROTOTYPE_URL, openCitationSheet, axeScan } from './helpers';
 */
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const PROTOTYPE_URL = process.env.PREFLIGHT_BASE_URL ?? 'http://100.81.83.98:8000';
export const API_URL = process.env.PREFLIGHT_API_URL ?? 'http://100.81.83.98:3000';
export const EVIDENCE_DIR = '.ui-redesign/evidence/preflight';

export const test = base;
export { expect };

/**
 * Axe-core scan against the current page. Returns the violations list.
 * Tag set: WCAG 2.2 AA + AAA-where-practical.
 */
export async function axeScan(page: import('@playwright/test').Page) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
  const results = await builder.analyze();
  return results.violations;
}

/**
 * Open the citation sheet on a conversation detail screen.
 * Clicks the first citation chip.
 */
export async function openCitationSheet(page: import('@playwright/test').Page) {
  // Navigate to a conversation first
  await page.locator('#conversation-list .conv').first().click();
  await page.waitForSelector('#citation-sheet', { state: 'hidden' });
  // Click the first citation chip
  await page.locator('.cite').first().click();
  await page.waitForSelector('#citation-sheet:not([hidden])', { timeout: 2000 });
}
