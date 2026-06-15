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
 *
 * The prototype's dev-controls panel (#dev-controls) sits at the
 * bottom of the viewport and can intercept pointer events on the
 * conversation list. We hide it before clicking, then restore it.
 */
export async function openCitationSheet(page: import('@playwright/test').Page) {
  // Hide the dev-controls panel to prevent it from intercepting clicks
  await page.evaluate(() => {
    const dc = document.querySelector('#dev-controls') as HTMLElement | null;
    if (dc) dc.style.display = 'none';
  });
  // Navigate to a conversation first
  await page.locator('#conversation-list .conv').first().click({ force: true });
  await page.waitForSelector('.screen[data-screen="conversation-detail"]:not([hidden])', { timeout: 2000 });
  // Click the first citation chip
  await page.locator('.cite').first().click({ force: true });
  await page.waitForSelector('#citation-sheet:not([hidden])', { timeout: 2000 });
  // Restore the dev-controls panel
  await page.evaluate(() => {
    const dc = document.querySelector('#dev-controls') as HTMLElement | null;
    if (dc) dc.style.display = '';
  });
}

/**
 * Hide the prototype's dev-controls panel (#dev-controls) which can
 * intercept pointer events on the conversation list. Call this at
 * the start of any test that interacts with the conversation list,
 * the dev toggles themselves, or the offline state.
 */
export async function hideDevControls(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const dc = document.querySelector('#dev-controls') as HTMLElement | null;
    if (dc) dc.style.display = 'none';
  });
}
