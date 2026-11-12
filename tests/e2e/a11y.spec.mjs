import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

for (const scheme of ['light', 'dark']) {
  for (const route of ['', '#/vuelos', '#/hotel', '#/calendario', '#/calendario/2026-12-10', '#/calendario/2026-12-09', '#/checklist']) {
    test(`axe WCAG 2.2 AA: ${route || 'inicio'} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/${route}`);
      await expect(page.locator('#page-title')).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    });
  }
}
test('respeta prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(
    await page
      .locator('a.card')
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toMatch(/^0s$/);
});
