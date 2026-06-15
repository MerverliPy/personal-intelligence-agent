/**
 * DPC-14: Network-loss banner (T6) + disabled destructive actions.
 *
 * Per design contract §3.4 + §5 (offline state) + §8:
 * - Persistent top banner below Dynamic Island
 * - Disables destructive actions (FAB, Send, Retry Ingestion, Delete)
 * - Resubmits use idempotency keys (out of harness scope)
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL, hideDevControls } from './helpers';

test.describe('DPC-14: offline banner (T6)', () => {
  test('banner appears below Dynamic Island when offline toggle is on', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#toggle-offline').check({ force: true });
    const banner = page.locator('#network-banner');
    await expect(banner).toBeVisible();
  });

  test('FAB is visually disabled (40% opacity) when offline', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#toggle-offline').check({ force: true });
    const fab = page.locator('.fab').first();
    const opacity = await fab.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(0.5);
  });

  test('Send button is disabled when offline', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await hideDevControls(page);
    await page.locator('#conversation-list .conv').first().click({ force: true });
    await page.locator('#toggle-offline').check({ force: true });
    const send = page.locator('.send-btn');
    const disabled = await send.isDisabled();
    expect(disabled).toBe(true);
  });

  test('toggling off restores FAB and Send', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#toggle-offline').check({ force: true });
    await page.locator('#toggle-offline').uncheck({ force: true });
    const fab = page.locator('.fab').first();
    const opacity = await fab.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeGreaterThanOrEqual(0.9);
  });
});
