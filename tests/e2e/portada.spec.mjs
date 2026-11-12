import { test, expect } from './fixtures.mjs';
import { statSync } from 'node:fs';

test.describe('portada con fotografía', () => {
  test('la foto es local, decorativa, 16:9 y no es un enlace', async ({ page }) => {
    const external = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('http://localhost') && !r.url().startsWith('data:'))
        external.push(r.url());
    });
    await page.goto('/');
    const img = page.locator('.hero-photo img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', '');
    expect(await img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await img.evaluate((i) => new URL(i.currentSrc).origin === location.origin && i.currentSrc.endsWith('.webp'))).toBe(true);
    expect(await img.evaluate((i) => i.closest('a, button') === null)).toBe(true);
    const box = await img.boundingBox();
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(external).toEqual([]);
  });

  test('conserva las cuatro tarjetas y el crédito de la licencia', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.card')).toHaveText([/Vuelos/, /Hotel/, /Calendario/, /Checklist/]);
    await expect(page.locator('.hero-photo figcaption')).toContainText('Michael Gray');
    await expect(page.locator('.credit a')).toHaveAttribute('href', /commons\.wikimedia\.org/);
    await expect(page.locator('.credit a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('las imágenes son WebP ligeras', async () => {
    for (const w of [640, 960, 1280]) {
      const size = statSync(`src/img/orlando-castillo-${w}.webp`).size;
      expect(size).toBeLessThan(150 * 1024);
    }
  });
});
