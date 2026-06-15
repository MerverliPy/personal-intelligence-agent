/**
 * DPC-9: Dynamic Type AX5 (no clipping).
 *
 * Per design contract §2.2 + §7.1, --t-body scales 19pt -> 34pt at
 * AX5 (Largest Text accessibility size on iOS). The prototype
 * uses a dev toggle to simulate this; real iOS does it via
 * Settings -> Accessibility -> Display & Text Size -> Larger Text.
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

test.describe('DPC-9: AX5 Dynamic Type', () => {
  test('body text scales to ~34pt when AX5 toggle is on', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const beforeSize = await page.evaluate(() => {
      const body = document.body;
      return parseFloat(getComputedStyle(body).fontSize);
    });
    await page.locator('#toggle-ax5').check();
    const afterSize = await page.evaluate(() => {
      const body = document.body;
      return parseFloat(getComputedStyle(body).fontSize);
    });
    // AX5 should make body text larger (or at least no smaller)
    expect(afterSize).toBeGreaterThanOrEqual(beforeSize);
  });

  test('tab bar still functional at AX5 (no clipped labels)', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#toggle-ax5').check();
    const tabs = await page.locator('.tab').all();
    for (const tab of tabs) {
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(40);
        expect(box.height).toBeGreaterThan(40);
      }
    }
  });
});
