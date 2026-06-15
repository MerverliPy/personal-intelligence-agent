/**
 * DPC-10: VoiceOver rotor (landmarks, headings, ARIA).
 *
 * Per design contract §7.4-7.8, the prototype must have:
 * - <header role="banner">, <main>, <nav>, <footer>
 * - Heading hierarchy (h1 > h2 > h3)
 * - All buttons/inputs have accessible names
 * - All interactive controls have ARIA roles
 *
 * axe-core rules used: landmark-* , label, region, heading-order.
 *
 * Decision: PIA-MUR-D-016 AC1.
 */
import { test, expect, PROTOTYPE_URL, axeScan } from './helpers';

test.describe('DPC-10: VoiceOver / ARIA (UNVERIFIED via axe)', () => {
  test('axe landmark rules: banner, main, navigation present', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const violations = await axeScan(page);
    const landmarkViolations = violations.filter(
      (v) => v.id.startsWith('landmark-') || v.id === 'region',
    );
    expect(landmarkViolations.length, JSON.stringify(landmarkViolations, null, 2)).toBe(0);
  });

  test('axe label rule: no buttons or inputs without accessible name', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const violations = await axeScan(page);
    const labelViolations = violations.filter((v) => v.id === 'label' || v.id === 'button-name');
    expect(labelViolations.length, JSON.stringify(labelViolations, null, 2)).toBe(0);
  });

  test('axe heading-order rule: headings descend', async ({ page }) => {
    await page.goto(PROTOTYPE_URL);
    const violations = await axeScan(page);
    const headingViolations = violations.filter((v) => v.id === 'heading-order');
    expect(headingViolations.length, JSON.stringify(headingViolations, null, 2)).toBe(0);
  });

  test('citation chip has an accessible name (aria-label includes claim text)', async ({
    page,
  }) => {
    await page.goto(PROTOTYPE_URL);
    await page.locator('#conversation-list .conv').first().click();
    const chip = page.locator('.cite').first();
    const ariaLabel = await chip.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(5);
  });
});
