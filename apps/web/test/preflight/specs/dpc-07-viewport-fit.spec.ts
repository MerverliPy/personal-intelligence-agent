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

  test('iPhone 16 Pro viewport is 393x852pt', async ({ page }) => {
    const size = page.viewportSize();
    expect(size).not.toBeNull();
    if (size) {
      expect(size.width).toBe(393);
      expect(size.height).toBe(852);
    }
  });
});
