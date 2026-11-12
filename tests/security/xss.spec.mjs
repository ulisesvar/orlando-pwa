import { test, expect } from '../e2e/fixtures.mjs';
import { readFileSync } from 'node:fs';

const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
const real = () => JSON.parse(readFileSync('src/data/trip.json', 'utf8'));
const serve = (page, mutate) =>
  page.route('**/data/trip.json', (r) => {
    const t = real();
    mutate(t);
    return r.fulfill({ json: t });
  });

// Sin Service Worker para que las respuestas simuladas no pasen por la caché.
test.use({ serviceWorkers: 'block' });

test.describe('datos manipulados (XSS)', () => {
  test('HTML en textos válidos se muestra como texto literal', async ({ page }) => {
    await serve(page, (t) => {
      t.days[0].items[0] = payload;
      t.hotel.name = payload;
      t.hotel.address = payload;
      t.checklist[0].items[0].text = payload;
      t.days[0].short = '<img src=x>';
    });
    await page.goto('/');
    await expect(page.locator('.week-day').first()).toContainText('<img src=x');
    await page.goto('/#/calendario');
    await expect(page.locator('.agenda li').first()).toHaveText(payload);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('main img, main script').count()).toBe(0);
  });
  test('consulta de mapa maliciosa queda codificada en el enlace', async ({ page }) => {
    await serve(page, (t) => {
      t.hotel.mapQuery = 'x" onmouseover="window.__xss=3" #&navigate=no';
    });
    await page.goto('/#/hotel');
    const href = await page.getByRole('link', { name: /Waze/ }).getAttribute('href');
    const u = new URL(href);
    expect(u.host).toBe('waze.com');
    expect(u.searchParams.get('navigate')).toBe('yes');
    expect(await page.getByRole('link', { name: /Waze/ }).getAttribute('onmouseover')).toBeNull();
  });
  test.describe('errores controlados (el navegador registra la falla)', () => {
    test.use({ expectConsoleErrors: true });
    test('datos que violan el esquema muestran error y no renderizan contenido', async ({ page }) => {
      await serve(page, (t) => {
        t.days[0].date = 'javascript:alert(1)';
        t.injected = payload;
      });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'No se pudo cargar' })).toBeVisible();
      await expect(page.locator('a.card')).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });
    test('JSON roto o respuesta 500 muestran error controlado', async ({ page }) => {
      await page.route('**/data/trip.json', (r) => r.fulfill({ status: 200, body: '{no es json', contentType: 'application/json' }));
      await page.goto('/');
      await expect(page.getByRole('alert')).toBeVisible();
      await page.unroute('**/data/trip.json');
      await page.route('**/data/trip.json', (r) => r.fulfill({ status: 500, body: 'boom' }));
      await page.reload();
      await expect(page.getByRole('alert')).toBeVisible();
    });
  });
  test('rutas manipuladas en el hash no ejecutan código', async ({ page }) => {
    await page.goto('/#/calendario/%3Cimg%20src=x%20onerror=window.__xss=4%3E');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
  test('estado de localStorage manipulado no se renderiza', async ({ page }) => {
    await page.addInitScript(
      (p) => localStorage.setItem('orlando2026:checklist:v1', JSON.stringify({ v: 1, done: [p, 'doc-pasaportes'] })),
      payload,
    );
    await page.goto('/#/checklist');
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
});
