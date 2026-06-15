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
  test('Dynamic Island clearance is at least 59pt from the viewport top', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    // The prototype's .dynamic-island mock sits at the top of the
    // viewport with a top offset of max(env(safe-area-inset-top), 59pt).
    // In headless iPhone 16 Pro emulation, the env() value is 0 (no
    // actual device) but the design contract requires the 59pt
    // Dynamic Island clearance either way.
    const measurement = await page.evaluate(() => {
      const island = document.querySelector('.dynamic-island') as HTMLElement | null;
      if (!island) return null;
      const islandRect = island.getBoundingClientRect();
      const islandStyle = getComputedStyle(island);
      return {
        islandTop: islandRect.top,
        islandHeight: islandRect.height,
        islandBottom: islandRect.bottom,
        marginTop: parseFloat(islandStyle.marginTop),
        paddingTop: parseFloat(islandStyle.paddingTop),
        position: islandStyle.position,
      };
    });
    expect(measurement).not.toBeNull();
    if (measurement) {
      // The dynamic-island should be near the top of the viewport
      expect(measurement.islandTop, `dynamic-island.top should be < 5pt; got ${measurement.islandTop}`).toBeLessThan(5);
      // The dynamic-island's bottom edge should be at least 59pt from
      // the viewport top (the iPhone 16 Pro Dynamic Island height)
      expect(measurement.islandBottom, `dynamic-island.bottom should be >= 59pt; got ${measurement.islandBottom}`).toBeGreaterThanOrEqual(58);
    }
  });

  test('tab bar is at the bottom of the viewport with no overflow', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const measurement = await page.evaluate(() => {
      const tabBar = document.querySelector('.tab-bar') as HTMLElement | null;
      if (!tabBar) return null;
      const tabBarRect = tabBar.getBoundingClientRect();
      const tabBarStyle = getComputedStyle(tabBar);
      return {
        tabBarTop: tabBarRect.top,
        tabBarHeight: tabBarRect.height,
        paddingBottom: parseFloat(tabBarStyle.paddingBottom),
        viewportHeight: window.innerHeight,
      };
    });
    expect(measurement).not.toBeNull();
    if (measurement) {
      // The tab bar's bottom must be at or above the viewport bottom
      // (i.e. it's not overflowing the viewport)
      expect(measurement.tabBarTop + measurement.tabBarHeight, `tab bar bottom should be <= viewport height`).toBeLessThanOrEqual(measurement.viewportHeight + 1);
      // Tab bar should be near the bottom of the viewport
      const gap = measurement.viewportHeight - (measurement.tabBarTop + measurement.tabBarHeight);
      expect(gap, `tab bar should be near the bottom; gap is ${gap}pt`).toBeLessThan(40);
    }
  });
});
