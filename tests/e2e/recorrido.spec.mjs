import { test, expect } from './fixtures.mjs';

const D9 = '#/calendario/2026-12-09';
const D10 = '#/calendario/2026-12-10';
const box = (page, name) => page.getByRole('checkbox', { name });

test.describe('recorrido integrado en Calendario', () => {
  test('la pantalla de inicio ya no tiene tarjeta «Recorrido»', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.card')).toHaveCount(4);
    await expect(page.getByRole('link', { name: /Recorrido|Itinerarios/ })).toHaveCount(0);
  });

  test('9 de diciembre: el recorrido aparece justo debajo de la agenda', async ({ page }) => {
    await page.goto(`/${D9}`);
    await expect(page.locator('.recorrido')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Recorrido: Magic Kingdom' })).toBeVisible();
    // Orden en el DOM: agenda del día y después el recorrido, sin otra navegación por fechas.
    const order = await page.evaluate(() => {
      const a = document.querySelector('.agenda');
      const r = document.querySelector('.recorrido');
      return a.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING ? 'agenda-antes' : 'otro';
    });
    expect(order).toBe('agenda-antes');
    const gap = await page.evaluate(() => {
      const panel = document.querySelector('article.panel');
      return document.querySelector('.recorrido').previousElementSibling === panel;
    });
    expect(gap).toBe(true);
    await expect(page.locator('.agenda li')).toHaveText(['Magic Kingdom.']);
    await expect(page.locator('.daytabs')).toHaveCount(1); // una sola navegación por fechas
    await expect(page.locator('.it-item')).toHaveCount(17);
    await expect(page.getByRole('checkbox')).toHaveCount(17);
  });

  test('10 de diciembre: recorrido de la fiesta, con horarios provisionales', async ({ page }) => {
    await page.goto(`/${D10}`);
    await expect(page.getByRole('heading', { level: 2, name: "Recorrido: Mickey's Very Merry Christmas Party" })).toBeVisible();
    await expect(page.locator('.it-item')).toHaveCount(18);
    await expect(page.locator('#it-disclaimer')).toContainText('provisionales');
    const fireworks = page.locator('.it-item', { hasText: 'Fuegos artificiales navideños' });
    await expect(fireworks).toContainText('~22:00');
    await expect(fireworks).toContainText('Horario provisional');
    await expect(page.locator('.it-item', { hasText: 'Primer desfile' })).toContainText('Omitirlo deliberadamente');
    await expect(page.locator('.agenda li')).toHaveText([
      "Mickey's Very Merry Christmas Party en Magic Kingdom.",
      'Entradas ya compradas; actividad confirmada.',
    ]);
  });

  test('otras fechas muestran únicamente la agenda existente', async ({ page }) => {
    for (const d of ['2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-11']) {
      await page.goto(`/#/calendario/${d}`);
      await expect(page.locator('.agenda li').first()).toBeVisible();
      await expect(page.locator('.recorrido')).toHaveCount(0);
      await expect(page.getByRole('checkbox')).toHaveCount(0);
    }
    await page.goto('/#/calendario'); // sin fecha: primer día (5 de diciembre)
    await expect(page.locator('.recorrido')).toHaveCount(0);
    await expect(page.getByText('No hay horarios definidos para las actividades')).toBeVisible();
  });

  test('cambiar de fecha en Calendario cambia el recorrido mostrado', async ({ page }) => {
    await page.goto('/#/calendario');
    await page.getByRole('link', { name: 'Miércoles 9' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Recorrido: Magic Kingdom' })).toBeVisible();
    await page.getByRole('link', { name: 'Jueves 10' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Mickey's Very Merry Christmas Party/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recorrido: Magic Kingdom' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Viernes 11' }).click();
    await expect(page.locator('.recorrido')).toHaveCount(0);
  });

  test('las rutas heredadas #/itinerarios redirigen a Calendario', async ({ page }) => {
    await page.goto('/#/itinerarios');
    await expect(page).toHaveURL(/#\/calendario$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendario');
    await page.goto('/#/itinerarios/2026-12-10');
    await expect(page).toHaveURL(/#\/calendario\/2026-12-10$/);
    await expect(page.locator('.recorrido')).toBeVisible();
    await page.goto('/#/itinerarios/2026-02-31');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });

  test('una sola casilla por actividad, prioridad y siguiente', async ({ page }) => {
    await page.goto(`/${D9}`);
    await expect(page.locator('.it-item')).toHaveCount(17);
    const times = await page.locator('.it-time').allTextContents();
    expect(times[0]).toBe('07:45');
    expect(times.at(-1)).toBe('Última hora');
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.locator('.it-next')).toContainText('Siguiente: 07:45 · Llegada al Transportation & Ticket Center');
    await expect(page.getByText('Imprescindible').first()).toBeVisible();
    await expect(page.locator('.it-item', { hasText: 'Mickey en Town Square Theater' })).toContainText('Si la fila supera 45 minutos');
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
    await page.locator('.it-item', { hasText: 'Peter Pan' }).click(); // el centro cae sobre la descripción
    await expect(box(page, /Peter Pan/)).toBeChecked();
  });

  test('cambiar de fecha no altera lo completado en otros días ni en el checklist', async ({ page }) => {
    await page.goto('/#/checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
    await page.goto(`/${D9}`);
    await box(page, /Llegada al Transportation/).check();
    await box(page, /Peter Pan/).check();
    // Navegar dentro de Calendario por las pestañas de fecha.
    await page.getByRole('link', { name: 'Jueves 10' }).click();
    await expect(box(page, /Llegada al Transportation/)).not.toBeChecked();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 0 de 18');
    await box(page, /Fuegos artificiales navideños/).check();
    await page.getByRole('link', { name: 'Viernes 11' }).click();
    await page.getByRole('link', { name: 'Miércoles 9' }).click();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 2 de 17');
    await expect(box(page, /Peter Pan/)).toBeChecked();
    await page.getByRole('link', { name: 'Jueves 10' }).click();
    await expect(page.locator('#it-progress')).toHaveText('Realizadas: 1 de 18');
    await page.goto('/#/checklist');
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
  });

  test('conserva el estado guardado antes de integrar la sección (misma clave) y migra «skipped»', async ({ page }) => {
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
