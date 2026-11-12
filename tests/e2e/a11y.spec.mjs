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

for (const scheme of ['light', 'dark']) {
  test(`axe WCAG 2.2 AA: aviso de actualización visible (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('a.card')).toHaveCount(4);
    await page.evaluate(async () => {
      const v = await import('./js/views.js');
      document.getElementById('update-slot').replaceChildren(v.updateBanner({ onUpdate: () => {}, onLater: () => {} }));
    });
    await expect(page.getByText('Nueva versión disponible')).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    for (const b of await page.locator('.update-banner button').all()) {
      const box = await b.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
