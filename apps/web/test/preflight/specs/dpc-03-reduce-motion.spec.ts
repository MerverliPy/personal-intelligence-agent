/**
 * DPC-3: prefers-reduced-motion in installed PWA mode (UNVERIFIED-2).
 *
 * Per design contract §6 + §9.3, reduce-motion sets all motion
 * tokens to 0.01ms. Sheets snap instantly. Both browser AND
 * installed PWA modes are tested.
 *
 * Note: in this headless harness, we can only verify browser
 * mode (PWA standalone requires a real iPhone per DPC-11).
 * Report as PARTIALLY_VERIFIED.
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL, openCitationSheet } from './helpers';

test.describe('DPC-3: reduce-motion in installed PWA (UNVERIFIED-2)', () => {
  test('Safari browser: sheet snaps instantly with reduce-motion ON', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PROTOTYPE_URL);
    await openCitationSheet(page);
    // Get the computed transition duration on the sheet panel
    const duration = await page.evaluate(() => {
      const panel = document.querySelector('.sheet__panel');
      return getComputedStyle(panel ?? document.body).transitionDuration;
    });
    // Should be 0.01ms (the design contract's reduce-motion value).
    // Browsers report this as either "0.01ms", "0s", or in
    // scientific notation "1e-05s". All are valid.
    expect(duration).toMatch(/1e-05s|0\.01m?s|0s/);
  });

  test('Safari browser: sheet animates with reduce-motion OFF (default)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(PROTOTYPE_URL);
    await openCitationSheet(page);
    const duration = await page.evaluate(() => {
      const panel = document.querySelector('.sheet__panel');
      return getComputedStyle(panel ?? document.body).transitionDuration;
    });
    // Should be 280ms (the design contract's --motion-sheet).
    // Browsers may report "0.28s", "280ms", or "0.28s, 0.28s, ..." for
    // multiple properties.
    expect(duration).toMatch(/0?\.28s|280m?s/);
  });
});
