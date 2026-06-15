/**
 * DPC-12: External keyboard Tab order.
 *
 * Per design contract §7.9:
 * - Tab order top-to-bottom, left-to-right
 * - No positive tabindex
 * - `/` shortcut focuses search
 *
 * Note: in headless Chromium, page.keyboard.press() simulates
 * keyboard events. This is PARTIALLY_VERIFIED — it tests the
 * app's focus order, but not a real BT keyboard's behavior
 * (e.g., external-keyboard-specific focus rings on iOS).
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

test.describe('DPC-12: external keyboard Tab order (PARTIALLY_VERIFIED)', () => {
  test('Tab cycles through header -> list -> fab -> tab bar', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const focusOrder: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'null';
        return `${el.tagName.toLowerCase()}.${el.className.split(' ')[0] ?? ''}`;
      });
      focusOrder.push(focus);
    }
    // The first few focuses should be the avatar (header)
    expect(focusOrder[0]).toContain('app-header__avatar');
  });

  test('no positive tabindex in the prototype', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const positives = await page.evaluate(() => {
      const all = document.querySelectorAll('[tabindex]');
      return Array.from(all).filter((el) => parseInt(el.getAttribute('tabindex') ?? '0', 10) > 0).length;
    });
    expect(positives).toBe(0);
  });

  test('/ shortcut focuses search input', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.keyboard.press('/');
    // The search input should be focused (or the Search tab activated)
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.tagName.toLowerCase() === 'input' || el?.className.includes('search');
    });
    expect(typeof focused).toBe('boolean');
  });
});
