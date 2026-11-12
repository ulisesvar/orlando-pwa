import { test, expect } from './fixtures.mjs';

const D9 = '#/itinerarios/2026-12-09';
const D10 = '#/itinerarios/2026-12-10';
const box = (page, name) => page.getByRole('checkbox', { name });

test.describe('recorrido de Magic Kingdom', () => {
  test('el índice enlaza ambos días con sus fechas', async ({ page }) => {
    await page.goto('/#/itinerarios');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recorrido');
    const cards = page.locator('a.card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Magic Kingdom');
    await expect(cards.nth(0)).toContainText('Miércoles 9 de diciembre de 2026');
    await expect(cards.nth(1)).toContainText("Mickey's Very Merry Christmas Party");
    await expect(cards.nth(1)).toContainText('Jueves 10 de diciembre de 2026');
  });

  test('la sección se llama «Recorrido» y no «Itinerarios» en la interfaz', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Recorrido/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Itinerarios/ })).toHaveCount(0);
    await page.getByRole('link', { name: /Recorrido/ }).click();
    await expect(page).toHaveURL(/#\/itinerarios$/); // la ruta interna se conserva
    await expect(page).toHaveTitle(/Recorrido/);
    await page.goto(`/${D9}`);
    await expect(page.locator('main')).not.toContainText(/Itinerarios/);
  });

  test('se llega desde el inicio y hay navegación entre los dos días', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Recorrido/ }).click();
    await page.locator('a.card').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Magic Kingdom');
    await page.getByRole('link', { name: /Christmas Party · 10 dic/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Mickey's Very Merry Christmas Party");
    await expect(page.getByRole('link', { name: /Christmas Party · 10 dic/ })).toHaveAttribute('aria-current', 'page');
  });

  test('9 de diciembre: una sola casilla por actividad, orden, prioridades y siguiente', async ({ page }) => {
    await page.goto(`/${D9}`);
    await expect(page.locator('.it-item')).toHaveCount(17); // esperar al montaje de la vista
    const times = await page.locator('.it-time').allTextContents();
    expect(times[0]).toBe('07:45');
    expect(times.at(-1)).toBe('Última hora');
    expect(times).toHaveLength(17);
    await expect(page.getByRole('checkbox')).toHaveCount(17);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Pendiente|Completada|Omitida/ })).toHaveCount(0);
    await expect(page.locator('.it-next')).toContainText('Siguiente: 07:45 · Llegada al Transportation & Ticket Center');
    await expect(page.getByText('Imprescindible').first()).toBeVisible();
    await expect(page.locator('.it-item', { hasText: 'Mickey en Town Square Theater' })).toContainText('Si la fila supera 45 minutos');
    await expect(page.locator('#it-disclaimer')).toContainText('orientativos');
  });

  test('10 de diciembre: horarios provisionales identificados', async ({ page }) => {
    await page.goto(`/${D10}`);
    await expect(page.locator('#it-disclaimer')).toContainText('provisionales');
    const fireworks = page.locator('.it-item', { hasText: 'Fuegos artificiales navideños' });
    await expect(fireworks).toContainText('~22:00');
    await expect(fireworks).toContainText('Horario provisional');
    await expect(page.locator('.it-item', { hasText: 'Primer desfile' })).toContainText('Omitirlo deliberadamente');
  });

  test('marcar y desmarcar actualiza progreso y siguiente, y persiste al recargar', async ({ page }) => {
    await page.goto(`/${D9}`);
    await box(page, /Llegada al Transportation/).check();
    await box(page, /Ferry o monorriel/).check();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 2 de 17');
    await expect(page.locator('.it-next')).toContainText('08:30 · Entrada al parque');
    await expect(page.locator('.tag-next:visible')).toHaveCount(1);
    await page.reload();
    await expect(box(page, /Llegada al Transportation/)).toBeChecked();
    await expect(box(page, /Ferry o monorriel/)).toBeChecked();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 2 de 17');
    await box(page, /Ferry o monorriel/).uncheck();
    await expect(page.locator('.it-next')).toContainText('08:15 · Ferry o monorriel');
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 1 de 17');
  });

  test('tocar cualquier parte de la tarjeta alterna la casilla', async ({ page }) => {
    await page.goto(`/${D9}`);
    await page.locator('.it-item', { hasText: 'Peter Pan' }).click(); // el centro cae sobre la descripción, no sobre el título
    await expect(box(page, /Peter Pan/)).toBeChecked();
  });

  test('los dos días y el checklist general tienen estados independientes', async ({ page }) => {
    await page.goto('/#/checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
    await page.goto(`/${D9}`);
    await box(page, /Llegada al Transportation/).check();
    await page.goto(`/${D10}`);
    await expect(box(page, /Llegada al Transportation/)).not.toBeChecked();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 0 de 18');
    await box(page, /Fuegos artificiales navideños/).check();
    await page.goto(`/${D9}`);
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 1 de 17');
    await page.goto('/#/checklist');
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
  });

  test('migración: estados «skipped» antiguos quedan pendientes y las completadas se conservan', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'orlando2026:itinerary:v1',
        JSON.stringify({ v: 1, days: { '2026-12-09': { ttc: 'done', ferry: 'skipped' }, '2026-12-10': { fuegos: 'done' } } }),
      ),
    );
    await page.goto(`/${D9}`);
    await expect(box(page, /Llegada al Transportation/)).toBeChecked();
    await expect(box(page, /Ferry o monorriel/)).not.toBeChecked();
    await expect(page.locator('.it-next')).toContainText('08:15 · Ferry o monorriel');
    await page.goto(`/${D10}`);
    await expect(box(page, /Fuegos artificiales navideños/)).toBeChecked();
  });

  test('se opera con teclado (Tab y Espacio)', async ({ page }) => {
    await page.goto(`/${D9}`);
    await box(page, /Llegada al Transportation/).focus();
    await page.keyboard.press('Space');
    await expect(box(page, /Llegada al Transportation/)).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(box(page, /Ferry o monorriel/)).toBeFocused();
  });

  test('fecha inexistente o manipulada muestra página no encontrada', async ({ page }) => {
    await page.goto('/#/itinerarios/2026-12-11');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await page.goto('/#/itinerarios/%3Cimg%20src=x%3E');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });

  test('sin desbordamiento horizontal y con áreas táctiles amplias', async ({ page }) => {
    await page.goto(`/${D10}`);
    await expect(page.locator('.it-item').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const el of await page.locator('.it-item').all()) {
      const b = await el.boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(56);
    }
  });
});
