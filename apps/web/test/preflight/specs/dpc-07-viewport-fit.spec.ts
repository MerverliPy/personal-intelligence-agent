/**
 * DPC-7: viewport-fit=cover edge-to-edge.
 *
 * Per design contract §8, the viewport meta has
 * viewport-fit=cover and the page renders edge-to-edge on
 * iPhone 16 Pro (393x852pt logical, 3x density).
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

test.describe('DPC-7: viewport-fit=cover', () => {
  test('viewport meta has viewport-fit=cover', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });

  test('iPhone 16 Pro viewport is 393x852pt (CSS pixels)', async ({ page }) => {
    // The custom device profile in playwright.config.ts sets
    // viewport: { width: 393, height: 852 } for iPhone 16 Pro.
    // Playwright's page.viewportSize() reports CSS pixels (not
    // device pixels); at deviceScaleFactor=3 the physical screen
    // is 1179x2556.
    const size = page.viewportSize();
    expect(size, 'viewport size should be defined').not.toBeNull();
    if (size) {
      expect(size.width, `viewport width should be 393pt; got ${size.width}`).toBe(393);
      expect(size.height, `viewport height should be 852pt; got ${size.height}`).toBe(852);
    }
  });
});
