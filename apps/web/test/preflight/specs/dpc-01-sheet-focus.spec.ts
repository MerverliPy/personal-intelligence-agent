/**
 * DPC-1: Custom sheet focus trap (UNVERIFIED-1a).
 *
 * Per design contract §3.4 + §7.9, the slide-up sheet must:
 * - Move focus into the sheet on open
 * - Cycle Tab within the sheet
 * - Close on Esc
 * - Close on backdrop tap
 * - Close on swipe-down > 80pt
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL, openCitationSheet } from './helpers';

test.describe('DPC-1: custom sheet focus (UNVERIFIED-1a)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
  });

  test('focus moves into the sheet on open', async ({ page }) => {
    await openCitationSheet(page);
    const sheet = page.locator('#citation-sheet');
    await expect(sheet).toBeVisible();
    // The first focusable inside the sheet should receive focus
    const focused = await page.evaluate(() => {
      const sheet = document.querySelector('#citation-sheet');
      return sheet?.querySelector('button, [tabindex="0"]') === document.activeElement;
    });
    expect(focused).toBe(true);
  });

  test('Tab cycles within the sheet', async ({ page }) => {
    await openCitationSheet(page);
    const sheet = page.locator('#citation-sheet');
    const tabbables = await sheet.locator('button, [tabindex="0"]').all();
    if (tabbables.length < 2) test.skip(true, 'fewer than 2 tabbables');
    for (let i = 0; i < tabbables.length + 1; i++) {
      await page.keyboard.press('Tab');
      const stillInside = await page.evaluate(() => {
        const sheet = document.querySelector('#citation-sheet');
        return sheet?.contains(document.activeElement) ?? false;
      });
      expect(stillInside).toBe(true);
    }
  });

  test('Esc closes the sheet', async ({ page }) => {
    await openCitationSheet(page);
    await page.keyboard.press('Escape');
    const stillOpen = await page.locator('#citation-sheet').isVisible();
    expect(stillOpen).toBe(false);
  });

  test('backdrop tap closes the sheet', async ({ page }) => {
    await openCitationSheet(page);
    // Click the backdrop (the .sheet element itself, not the panel)
    await page.locator('#citation-sheet').click({ position: { x: 10, y: 10 } });
    const stillOpen = await page.locator('#citation-sheet').isVisible();
    expect(stillOpen).toBe(false);
  });
});
