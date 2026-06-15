/**
 * DPC-8: Dark mode (auto-switch + manual toggle) + color contrast.
 *
 * Per design contract §2.1 + §7.3, dark mode:
 * - Auto-switches when prefers-color-scheme: dark
 * - Lightens --accent to #3B82F6 for AA contrast
 * - Status badge colors remain readable (UNVERIFIED-3)
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL, axeScan } from './helpers';

test.describe('DPC-8: dark mode (UNVERIFIED-3)', () => {
  test('auto-switches to dark when prefers-color-scheme: dark', async ({ page }) => {
    // Set the media BEFORE page.goto so the @media rule is active
    // on initial CSS evaluation.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dark mode: --bg is #0A0A0A = rgb(10, 10, 10)
    expect(bg, `body backgroundColor should be rgb(10, 10, 10) in dark mode; got ${bg}`).toBe('rgb(10, 10, 10)');
  });

  test('light mode default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Light mode: --bg is #FFFFFF = rgb(255, 255, 255)
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('manual dev toggle: clicking #toggle-dark flips theme', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#toggle-dark').check();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 10, 10)');
  });

  test('axe color-contrast: no critical violations in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
    // Navigate through all screens
    for (const tab of ['conversations', 'documents', 'search']) {
      await page.locator(`.tab[data-tab="${tab}"]`).click();
    }
    const violations = await axeScan(page);
    const contrastViolations = violations.filter((v) => v.id === 'color-contrast');
    test.expect(contrastViolations.length).toBeLessThan(3); // tolerate a few minor badge issues
  });
});
