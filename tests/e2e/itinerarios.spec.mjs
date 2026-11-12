import { test, expect } from './fixtures.mjs';

const D9 = '#/itinerarios/2026-12-09';
const D10 = '#/itinerarios/2026-12-10';
const group = (page, name) => page.getByRole('group', { name: `Estado de ${name}` });

test.describe('itinerarios de Magic Kingdom', () => {
  test('el índice enlaza ambos días con sus fechas', async ({ page }) => {
    await page.goto('/#/itinerarios');
    const cards = page.locator('a.card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Magic Kingdom');
    await expect(cards.nth(0)).toContainText('Miércoles 9 de diciembre de 2026');
    await expect(cards.nth(1)).toContainText("Mickey's Very Merry Christmas Party");
    await expect(cards.nth(1)).toContainText('Jueves 10 de diciembre de 2026');
  });

  test('se llega desde el inicio y hay navegación entre los dos días', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Itinerarios/ }).click();
    await expect(page).toHaveURL(/#\/itinerarios$/);
    await page.locator('a.card').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Magic Kingdom');
    await page.getByRole('link', { name: /Christmas Party · 10 dic/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Mickey's Very Merry Christmas Party");
    await expect(page.getByRole('link', { name: /Christmas Party · 10 dic/ })).toHaveAttribute('aria-current', 'page');
  });

  test('9 de diciembre: actividades en orden, prioridades y siguiente', async ({ page }) => {
    await page.goto(`/${D9}`);
    const times = await page.locator('.it-time').allTextContents();
    expect(times[0]).toBe('07:45');
    expect(times.at(-1)).toBe('Última hora');
    expect(times).toHaveLength(17);
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

  test('marcar completada/omitida actualiza progreso y siguiente, y persiste al recargar', async ({ page }) => {
    await page.goto(`/${D9}`);
    await group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Completada').check();
    await group(page, 'Ferry o monorriel').getByLabel('Omitida').check();
    await expect(page.locator('#it-progress')).toHaveText('Completadas: 1 · Omitidas: 1 · Pendientes: 15 de 17');
    await expect(page.locator('.it-next')).toContainText('08:30 · Entrada al parque');
    await page.reload();
    await expect(group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Completada')).toBeChecked();
    await expect(group(page, 'Ferry o monorriel').getByLabel('Omitida')).toBeChecked();
    await expect(page.locator('#it-progress')).toHaveText('Completadas: 1 · Omitidas: 1 · Pendientes: 15 de 17');
    await group(page, 'Ferry o monorriel').getByLabel('Pendiente').check();
    await expect(page.locator('.it-next')).toContainText('08:15 · Ferry o monorriel');
  });

  test('los dos días y el checklist tienen estados independientes', async ({ page }) => {
    await page.goto('/#/checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
    await page.goto(`/${D9}`);
    await group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Completada').check();
    await page.goto(`/${D10}`);
    await expect(group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Pendiente')).toBeChecked();
    await expect(page.locator('#it-progress')).toContainText('Completadas: 0');
    await group(page, 'Fuegos artificiales navideños').getByLabel('Completada').check();
    await page.goto(`/${D9}`);
    await expect(page.locator('#it-progress')).toHaveText('Completadas: 1 · Omitidas: 0 · Pendientes: 16 de 17');
    await page.goto('/#/checklist');
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
  });

  test('se opera con teclado', async ({ page }) => {
    await page.goto(`/${D9}`);
    await group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Pendiente').focus();
    await page.keyboard.press('ArrowDown');
    await expect(group(page, 'Llegada al Transportation & Ticket Center').getByLabel('Completada')).toBeChecked();
  });

  test('fecha inexistente o manipulada muestra página no encontrada', async ({ page }) => {
    await page.goto('/#/itinerarios/2026-12-11');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await page.goto('/#/itinerarios/%3Cimg%20src=x%3E');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });

  test('sin horizontal overflow en móvil', async ({ page }) => {
    await page.goto(`/${D10}`);
    await expect(page.locator('.it-item').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
