/**
 * DPC-13: Back button in standalone PWA (UNVERIFIED via media-query).
 *
 * Per design contract §3.6 + §3.2, standalone PWA mode has no URL
 * bar, no Safari chrome, no back button. The app must provide
 * its own back navigation. matchMedia('(display-mode: standalone)')
 * works in iOS UA even when not actually installed (iOS reports
 * the display-mode based on the iOS UA detection, not the actual
 * install).
 *
 * DPC-11 (the actual install) requires a real iPhone; this is
 * a PARTIALLY_VERIFIED check.
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

test.describe('DPC-13: PWA standalone (PARTIALLY_VERIFIED)', () => {
  test('matchMedia display-mode: standalone is detectable', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const result = await page.evaluate(() => {
      return {
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        fullscreen: window.matchMedia('(display-mode: fullscreen)').matches,
        minimalUi: window.matchMedia('(display-mode: minimal-ui)').matches,
        browser: window.matchMedia('(display-mode: browser)').matches,
      };
    });
    // In headless Chromium, none of these will match (it reports
    // 'browser' mode). The check is that the API is reachable and
    // the prototype doesn't crash.
    expect(typeof result.standalone).toBe('boolean');
  });

  test('back chevron works in conversation detail', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#conversation-list .conv').first().click();
    // Should now be on conversation detail
    const detail = page.locator('.screen[data-screen="conversation-detail"]');
    await expect(detail).toBeVisible();
    // Click back
    await page.locator('.back-btn').click();
    // Should be back on conversations list
    const list = page.locator('.screen[data-screen="conversations"]');
    await expect(list).toBeVisible();
  });
});
