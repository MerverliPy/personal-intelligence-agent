/**
 * DPC-4: Touch-target bounding-box sizes (UNVERIFIED-4).
 *
 * Per design contract §7.2, minimum 44x44pt; primary 56x56pt;
 * citation chip 16pt visible glyph + 44pt tap area.
 *
 * Predicted FAILs (per specialist's pre-evaluation):
 * - Avatar: 32pt x 32pt (CSS: .app-header__avatar)
 * - Citation chip: 18pt x 24pt (CSS: .citation-chip min-width/height)
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL } from './helpers';

const MIN_TOUCH = 44;
const PRIMARY = 56;

test.describe('DPC-4: touch targets (UNVERIFIED-4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
  });

  test('tab bar buttons meet 44pt', async ({ page }) => {
    const tabs = await page.locator('.tab').all();
    for (const tab of tabs) {
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width, `tab width`).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(box.height, `tab height`).toBeGreaterThanOrEqual(MIN_TOUCH);
      }
    }
  });

  test('FAB meets 56pt (primary)', async ({ page }) => {
    const fab = page.locator('.fab').first();
    const box = await fab.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(PRIMARY);
      expect(box.height).toBeGreaterThanOrEqual(PRIMARY);
    }
  });

  test('Send button meets 56pt (primary)', async ({ page }) => {
    // Navigate to a conversation to expose the composer
    await page.locator('#conversation-list .conv').first().click();
    const sendBtn = page.locator('.send-btn');
    const box = await sendBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(PRIMARY);
      expect(box.height).toBeGreaterThanOrEqual(PRIMARY);
    }
  });

  test('avatar meets 44pt (expected FAIL — CSS says 32pt)', async ({ page }) => {
    const avatar = page.locator('.app-header__avatar');
    const box = await avatar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Expected to fail; this test documents the actual size
      const meets = box.width >= MIN_TOUCH && box.height >= MIN_TOUCH;
      if (!meets) {
        test.info().annotations.push({
          type: 'predicted-fail',
          description: `Avatar is ${box.width}x${box.height}pt; < 44pt minimum. Triggers PIA-MUR-D-009.`,
        });
      }
      expect(meets, `avatar ${box.width}x${box.height}pt must be >= ${MIN_TOUCH}pt`).toBe(true);
    }
  });

  test('back chevron meets 44pt', async ({ page }) => {
    await page.locator('#conversation-list .conv').first().click();
    const back = page.locator('.back-btn');
    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
  });

  test('citation chip tap area meets 44pt (expected FAIL — CSS says 18x24)', async ({ page }) => {
    await page.locator('#conversation-list .conv').first().click();
    const chip = page.locator('.cite').first();
    const box = await chip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const meets = box.width >= MIN_TOUCH && box.height >= MIN_TOUCH;
      if (!meets) {
        test.info().annotations.push({
          type: 'predicted-fail',
          description: `Citation chip is ${box.width}x${box.height}pt; < 44pt minimum. Triggers PIA-MUR-D-009.`,
        });
      }
      expect(meets, `citation chip ${box.width}x${box.height}pt must be >= ${MIN_TOUCH}pt`).toBe(true);
    }
  });
});
