import { test, expect } from './fixtures.mjs';

test.describe('pantalla principal', () => {
  test('encabezado, siete días y cuatro tarjetas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('NUESTRO VIAJE')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
    await expect(page.getByText('5–11 de diciembre de 2026')).toBeVisible();
    const days = page.locator('.week-day');
    await expect(days).toHaveCount(7);
    await expect(days).toHaveText([
      /Sáb\s*5\s*Llegada \/ Walmart/,
      /Dom\s*6\s*Universal/,
      /Lun\s*7\s*Mall/,
      /Mar\s*8\s*Libre/,
      /Mié\s*9\s*Magic Kingdom/,
      /Jue\s*10\s*Very Merry/,
      /Vie\s*11\s*Regreso/,
    ]);
    await expect(page.locator('.week a, .week button')).toHaveCount(0); // informativo, no interactivo
    const cards = page.locator('a.card');
    await expect(cards).toHaveCount(5);
    await expect(cards).toHaveText([
      /Vuelos\s*Horarios y detalles/,
      /Hotel\s*Ubicación y Waze/,
      /Calendario\s*Actividades por día/,
      /Recorrido\s*Magic Kingdom: 9 y 10 de diciembre/,
      /Checklist\s*Lista de pendientes/,
    ]);
  });

  test('las siete columnas caben en una fila en móvil y las tarjetas son 2×2', async ({ page, isMobile }) => {
    test.skip(!isMobile);
    await page.goto('/');
    const tops = await page.locator('.week-day').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const boxes = await page.locator('a.card').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top)];
      }),
    );
    expect(boxes[0][1]).toBe(boxes[1][1]);
    expect(boxes[2][1]).toBe(boxes[3][1]);
    expect(boxes[2][1]).toBeGreaterThan(boxes[0][1]);
    expect(boxes[0][0]).toBeLessThan(boxes[1][0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('controles con área táctil de al menos 44×44', async ({ page }) => {
    await page.goto('/');
    for (const el of await page.locator('a.card').all()) {
      const b = await el.boundingBox();
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    for (const route of ['#/vuelos', '#/hotel', '#/calendario', '#/itinerarios', '#/itinerarios/2026-12-10', '#/checklist']) {
      await page.goto(`/${route}`);
      for (const el of await page.locator('a.back, a.btn, a.daytab, .checks label, .it-status label, button').all()) {
        const b = await el.boundingBox();
        if (!b) continue;
        expect(b.height, `${route} alto`).toBeGreaterThanOrEqual(44);
        expect(b.width, `${route} ancho`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('vuelos', () => {
  test('muestra horarios de ida y regreso con zona horaria', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Vuelos/ }).click();
    await expect(page).toHaveURL(/#\/vuelos$/);
    await expect(page.getByText('Volaris', { exact: true })).toBeVisible();
    const ida = page.getByRole('article').filter({ hasText: 'Vuelo de ida' });
    await expect(ida).toContainText('Y4780');
    await expect(ida).toContainText('Sábado 5 de diciembre de 2026');
    await expect(ida).toContainText('11:10 a. m.');
    await expect(ida).toContainText('3:18 p. m.');
    await expect(ida).toContainText('Orlando (MCO)'.replace('Orlando', 'Aeropuerto Internacional de Orlando'));
    await expect(ida).toContainText('America/New_York');
    const vuelta = page.getByRole('article').filter({ hasText: 'Vuelo de regreso' });
    await expect(vuelta).toContainText('Y4781');
    await expect(vuelta).toContainText('Viernes 11 de diciembre de 2026');
    await expect(vuelta).toContainText('5:05 p. m.');
    await expect(vuelta).toContainText('7:45 p. m.');
    await expect(page.getByText('Todos los horarios son locales de sus respectivos aeropuertos.')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/terminal|puerta|asiento|reserva/i);
  });
});

test.describe('hotel', () => {
  test('muestra el hotel y enlaces externos seguros', async ({ page }) => {
    await page.goto('/#/hotel');
    await expect(page.getByRole('heading', { name: 'Vacation Village at Parkway' })).toBeVisible();
    await expect(page.getByText('Kissimmee, Florida')).toBeVisible();
    const waze = page.getByRole('link', { name: /Ir con Waze/ });
    await expect(page.getByText('2975 Arabian Nights Blvd, Kissimmee, FL 34747, Estados Unidos')).toBeVisible();
    await expect(waze).toHaveAttribute('href', /^https:\/\/waze\.com\/ul\?q=2975%20Arabian%20Nights%20Blvd.*34747.*&navigate=yes$/);
    await expect(page.getByText(/check-?in|check-?out|checkout/i)).toHaveCount(0);
    await expect(waze).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(waze).toHaveAttribute('target', '_blank');
    const gm = page.getByRole('link', { name: /Google Maps/ });
    await expect(gm).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=2975%20Arabian%20Nights%20Blvd/);
    await expect(gm).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(page.locator('main')).not.toContainText(/habitaci[oó]n n|reservaci[oó]n n/i);
  });
});

test.describe('calendario', () => {
  test('navega por día y refleja el itinerario', async ({ page }) => {
    await page.goto('/#/calendario');
    await expect(page.getByRole('heading', { level: 2, name: 'Sábado 5 de diciembre de 2026' })).toBeVisible();
    for (const t of ['Llegada a MCO.', 'Recoger automóvil de Alamo.', 'Traslado al hotel.', 'Compras en Walmart.'])
      await expect(page.getByText(t)).toBeVisible();
    await page.getByRole('link', { name: 'Domingo 6' }).click();
    await expect(page).toHaveURL(/#\/calendario\/2026-12-06$/);
    await expect(page.locator('.agenda li')).toHaveText(['Universal.']);
    await page.getByRole('link', { name: 'Jueves 10' }).click();
    await expect(page.locator('.agenda li')).toHaveText([
      "Mickey's Very Merry Christmas Party en Magic Kingdom.",
      'Entradas ya compradas; actividad confirmada.',
    ]);
    await expect(page.getByRole('link', { name: 'Jueves 10' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Viernes 11' }).click();
    await expect(page.locator('.agenda li')).toHaveText(['Checkout.', 'Devolución del automóvil.', 'Vuelo de regreso.']);
    await page.getByRole('link', { name: 'Miércoles 9' }).click();
    await expect(page.locator('.agenda li')).toHaveText(['Magic Kingdom.']);
  });
  test('un día inexistente muestra página no encontrada', async ({ page }) => {
    await page.goto('/#/calendario/2026-02-31');
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });
});

test.describe('navegación', () => {
  test('botón Atrás, enlaces directos y recarga', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Hotel/ }).click();
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hotel');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hotel');
    await page.goto('/#/checklist');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Checklist');
    await expect(page).toHaveTitle(/Checklist/);
  });
  test('uso con teclado', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.card')).toHaveCount(5); // la vista se monta tras cargar los datos
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Vuelos/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Calendario/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/calendario$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
  test('el foco es visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.card')).toHaveCount(5);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Vuelos/ })).toBeFocused();
    const outline = await page
      .getByRole('link', { name: /Vuelos/ })
      .evaluate((e) => getComputedStyle(e).outlineStyle + getComputedStyle(e).outlineWidth);
    expect(outline).toBe('solid3px');
  });
});

test.describe('checklist', () => {
  test('marca, persiste tras recargar y restablece con confirmación', async ({ page }) => {
    await page.goto('/#/checklist');
    const first = page.getByLabel('Pasaportes vigentes para todos los viajeros');
    await expect(first).not.toBeChecked();
    for (const g of ['Documentos', 'Equipaje', 'Dispositivos', 'Salud', 'Preparativos'])
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${g}`) })).toBeVisible();
    await first.check();
    await expect(page.locator('#progress')).toHaveText(/^1 de \d+ completados$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('orlando2026:checklist:v1')))).toEqual({
      v: 1,
      done: ['doc-pasaportes'],
    });
    await page.reload();
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
    // cancelar no borra
    await page.getByRole('button', { name: 'Restablecer checklist' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
    // confirmar borra
    await page.getByRole('button', { name: 'Restablecer checklist' }).click();
    await page.getByRole('button', { name: 'Sí, restablecer' }).click();
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('orlando2026:checklist:v1'))).toBeNull();
  });
  test('se opera con teclado', async ({ page }) => {
    await page.goto('/#/checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
  });
  test('tolera estado corrupto en localStorage', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('orlando2026:checklist:v1', '{corrupto'));
    await page.goto('/#/checklist');
    await expect(page.locator('#progress')).toHaveText(/^0 de/);
  });
  test('funciona si localStorage está bloqueado', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    await page.goto('/#/checklist');
    // Sin almacenamiento no hay autorización persistente: se pide el correo y el acceso vive solo en memoria.
    await page.getByLabel('Correo electrónico').fill('ulises.vargas@gmail.com');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    await expect(page.getByRole('alert')).toContainText('no permite guardar');
  });
});
