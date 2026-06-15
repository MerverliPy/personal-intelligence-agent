/**
 * DPC-6: Safe-area insets (Dynamic Island, home indicator).
 *
 * Per design contract §8, the header clears the Dynamic Island
 * (max(env(safe-area-inset-top), 59pt)) and the tab bar clears
 * the home indicator (49pt + env(safe-area-inset-bottom)).
 *
 * In headless emulation, the iPhone 16 Pro env(safe-area-inset-*)
 * values are set by the device emulation. We assert that the
 * header and tab bar respect those insets.
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

test.describe('DPC-6: safe-area insets', () => {
  test('header clears Dynamic Island (>= 59pt top padding)', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const headerBox = await page.locator('.app-header').boundingBox();
    expect(headerBox).not.toBeNull();
    if (headerBox) {
      // The header's effective top inset should be at least 59pt
      // (or env(safe-area-inset-top) which iPhone 16 Pro = 59)
      const topInset = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        return header ? parseFloat(getComputedStyle(header).paddingTop) : 0;
      });
      expect(topInset).toBeGreaterThanOrEqual(59);
    }
  });

  test('tab bar includes home-indicator clearance', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const tabBarBox = await page.locator('.tab-bar').boundingBox();
    expect(tabBarBox).not.toBeNull();
    if (tabBarBox) {
      const bottomInset = await page.evaluate(() => {
        const tabBar = document.querySelector('.tab-bar');
        return tabBar ? parseFloat(getComputedStyle(tabBar).paddingBottom) : 0;
      });
      // iPhone 16 Pro safe-area-inset-bottom = 34pt; tab bar
      // height is 49pt + bottom inset per design contract
      expect(bottomInset).toBeGreaterThan(0);
    }
  });
});
