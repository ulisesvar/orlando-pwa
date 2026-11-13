import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures.mjs';

const controlled = (page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  });
async function installed(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => controlled(page)).toBe(true);
}

test.describe('manifest e instalación', () => {
  test('manifest válido con iconos PNG 192/512 y maskable', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    const res = await request.get(new URL(href, page.url()).href);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ name: 'Orlando 2026', short_name: 'Orlando 2026', start_url: './', scope: './', display: 'standalone' });
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    const has = (size, purpose) => m.icons.some((i) => i.sizes === size && i.type === 'image/png' && i.purpose === purpose);
    expect(has('192x192', 'any') && has('512x512', 'any') && has('512x512', 'maskable')).toBe(true);
    for (const i of m.icons) {
      const r = await request.get(new URL(i.src, new URL(href, page.url())).href);
      expect(r.ok()).toBe(true);
      expect(r.headers()['content-type']).toBe('image/png');
      const b = await r.body();
      expect([...b.subarray(1, 4)]).toEqual([80, 78, 71]);
      expect(b.readUInt32BE(16)).toBe(Number(i.sizes.split('x')[0]));
    }
  });

  test('Chromium no reporta errores de instalabilidad', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium');
    await installed(page);
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  });
});

test.describe('service worker y offline', () => {
  test('se registra en contexto seguro y precachea la app', async ({ page }) => {
    await installed(page);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^orlando-[0-9a-f]{12}$/);
    const cached = await page.evaluate(async () =>
      (await (await caches.open((await caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname),
    );
    for (const p of ['/', '/index.html', '/js/main.js', '/css/app.css', '/data/trip.json', '/manifest.webmanifest'])
      expect(cached).toContain(p);
    // Acceso familiar: módulo, lista y todos los módulos JS/JSON necesarios offline.
    for (const p of [
      '/img/orlando-castillo-640.webp',
      '/img/orlando-castillo-960.webp',
      '/img/orlando-castillo-1280.webp',
      '/js/auth.js',
      '/js/itinerary.js',
      '/data/itineraries.json',
      '/data/access.json',
      '/js/views.js',
      '/js/validate.js',
    ])
      expect(cached).toContain(p);
    expect(cached).not.toContain('/sw.js');
  });

  test('funciona sin conexión tras la primera carga', async ({ page, context }) => {
    await installed(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
    await expect(page.locator('.hero-photo img')).toBeVisible();
    expect(await page.locator('.hero-photo img').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true); // la foto sale de la caché
    await page.getByRole('link', { name: /Vuelos/ }).click();
    await expect(page.getByText('Y4780')).toBeVisible();
    await page.goto('/#/calendario/2026-12-10');
    await expect(page.getByText('Entradas ya compradas; actividad confirmada.')).toBeVisible();
    await page.goto('/#/checklist');
    await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
    await expect(page.locator('#progress')).toHaveText(/^1 de/);
    await context.setOffline(false);
  });

  test('no intercepta rutas ajenas ni otros orígenes', async ({ page }) => {
    await installed(page);
    const src = await page.evaluate(async () => (await fetch('/sw.js')).text());
    expect(src).toContain('url.origin !== SCOPE.origin');
    const keys = await page.evaluate(async () => {
      const c = await caches.open((await caches.keys())[0]);
      return (await c.keys()).map((r) => new URL(r.url).origin);
    });
    expect(new Set(keys).size).toBe(1);
  });
});

// Sitio temporal servido desde una copia de dist/ que se puede "publicar" como versión 2.
async function makeSite(browser) {
  const dir = mkdtempSync(join(tmpdir(), 'orlando-sw-'));
  cpSync('dist', dir, { recursive: true });
  const port = 4190 + Math.floor(Math.random() * 500);
  const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, SERVE_DIR: dir, PORT: String(port) }, stdio: 'ignore' });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    // Solo si no existe: así no se pisa lo que la persona ya guardó en recargas posteriores.
    if (!localStorage.getItem('orlando-family-email-v1')) localStorage.setItem('orlando-family-email-v1', 'ulises.vargas@gmail.com');
  });
  const base = `http://127.0.0.1:${port}/`;
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(base)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 10000 },
    )
    .toBe(200);
  const publishV2 = () => {
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8').replace(/const BUILD_ID = '[^']+'/, "const BUILD_ID = 'v2update0000'");
    writeFileSync(join(dir, 'sw.js'), sw);
    const trip = readFileSync(join(dir, 'data/trip.json'), 'utf8').replace('"title": "Orlando 2026"', '"title": "Orlando 2026 v2"');
    writeFileSync(join(dir, 'data/trip.json'), trip);
  };
  const close = async () => {
    await ctx.close();
    srv.kill();
    rmSync(dir, { recursive: true, force: true });
  };
  return { ctx, base, publishV2, close };
}

async function installV1(site) {
  const page = await site.ctx.newPage();
  const loads = { n: 0 };
  page.on('load', () => loads.n++);
  await page.goto(site.base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => controlled(page)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
  return { page, loads };
}
const checkForUpdate = (page) =>
  page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
const cacheNames = (page) => page.evaluate(() => caches.keys()).then((k) => k.sort());
const banner = (page) => page.getByText('Nueva versión disponible');

test.describe('actualización del service worker (con confirmación)', () => {
  test('la primera instalación no muestra aviso ni recarga', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page, loads } = await installV1(site);
      const before = loads.n;
      await page.waitForTimeout(1000);
      await expect(banner(page)).toHaveCount(0);
      expect(loads.n).toBe(before);
      expect(await cacheNames(page)).toHaveLength(1);
    } finally {
      await site.close();
    }
  });

  test('una versión nueva queda en espera: se avisa, no se activa sola y la actual sigue funcionando', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page, loads } = await installV1(site);
      const before = loads.n;
      const [v1] = await cacheNames(page);
      site.publishV2();
      await checkForUpdate(page);
      await expect(banner(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Actualizar ahora' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Más tarde' })).toBeVisible();
      await expect(banner(page)).toHaveCount(1); // sin avisos duplicados
      // Descargada pero en espera: conviven ambas cachés y la página sigue en la versión instalada.
      expect(await cacheNames(page)).toEqual([v1, 'orlando-v2update0000'].sort());
      await page.waitForTimeout(1500);
      expect(loads.n).toBe(before);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
      const reg = await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return { waiting: !!r.waiting, active: !!r.active };
      });
      expect(reg).toEqual({ waiting: true, active: true });
    } finally {
      await site.close();
    }
  });

  test('«Más tarde» conserva la versión actual y se vuelve a ofrecer en una apertura posterior', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page, loads } = await installV1(site);
      site.publishV2();
      await checkForUpdate(page);
      await expect(banner(page)).toBeVisible();
      const before = loads.n;
      await page.getByRole('button', { name: 'Más tarde' }).click();
      await expect(banner(page)).toHaveCount(0);
      await checkForUpdate(page); // la comprobación repetida no vuelve a molestar
      await page.waitForTimeout(500);
      await expect(banner(page)).toHaveCount(0);
      expect(loads.n).toBe(before);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
      await page.getByRole('link', { name: /Hotel/ }).click(); // sigue usable
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hotel');
      // Apertura posterior: la versión sigue en espera, así que se ofrece otra vez.
      await page.goto(site.base);
      await page.reload();
      await expect(banner(page)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026'); // aún la versión instalada
    } finally {
      await site.close();
    }
  });

  test('«Actualizar ahora» activa la versión nueva, recarga una sola vez y conserva los datos locales', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page, loads } = await installV1(site);
      await page.evaluate(() => {
        localStorage.setItem('orlando2026:checklist:v1', JSON.stringify({ v: 1, done: ['doc-pasaportes'] }));
        localStorage.setItem(
          'orlando2026:itinerary:v1',
          JSON.stringify({ v: 1, days: { '2026-12-09': { ttc: 'done' }, '2026-12-10': { fuegos: 'done' } } }),
        );
      });
      site.publishV2();
      await checkForUpdate(page);
      await expect(banner(page)).toBeVisible();
      const before = loads.n;
      await page.getByRole('button', { name: 'Actualizar ahora' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026 v2');
      await expect.poll(() => cacheNames(page)).toEqual(['orlando-v2update0000']); // la caché anterior se elimina
      await expect(banner(page)).toHaveCount(0);
      // Ausencia de recargas infinitas: tras la recarga única no hay más navegaciones.
      expect(loads.n).toBe(before + 1);
      await page.waitForTimeout(2500);
      expect(loads.n).toBe(before + 1);
      // El nuevo Service Worker controla la página.
      expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js'))).toBe(true);
      // Datos locales intactos: acceso (sin pedir correo), checklist y recorridos de ambos días.
      await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
      await page.goto(`${site.base}#/checklist`);
      await expect(page.locator('#progress')).toHaveText(/^1 de/);
      await expect(page.getByLabel('Pasaportes vigentes para todos los viajeros')).toBeChecked();
      await page.goto(`${site.base}#/calendario/2026-12-09`);
      await expect(page.getByRole('checkbox', { name: /Llegada al Transportation/ })).toBeChecked();
      await expect(page.locator('#it-progress')).toHaveText('Realizadas: 1 de 17');
      await page.goto(`${site.base}#/calendario/2026-12-10`);
      await expect(page.getByRole('checkbox', { name: /Fuegos artificiales navideños/ })).toBeChecked();
    } finally {
      await site.close();
    }
  });

  test('sin conexión sigue funcionando la versión instalada, incluso con una actualización pendiente', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page } = await installV1(site);
      site.publishV2();
      await checkForUpdate(page);
      await expect(banner(page)).toBeVisible();
      await site.ctx.setOffline(true);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026'); // versión instalada, desde caché
      await expect(page.locator('a.card')).toHaveCount(4);
      await expect(banner(page)).toBeVisible(); // la versión en espera sigue ofreciéndose
      await page.getByRole('link', { name: /Vuelos/ }).click();
      await expect(page.getByText('Y4780')).toBeVisible();
      await site.ctx.setOffline(false);
    } finally {
      await site.close();
    }
  });

  test('con varias pestañas: al actualizar en una, todas pasan a la versión nueva sin mezclar archivos', async ({ browser }) => {
    const site = await makeSite(browser);
    try {
      const { page: a, loads: la } = await installV1(site);
      const b = await site.ctx.newPage();
      const lb = { n: 0 };
      b.on('load', () => lb.n++);
      await b.goto(site.base);
      await expect(b.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
      site.publishV2();
      await checkForUpdate(a);
      await expect(banner(a)).toBeVisible();
      // Dos pestañas abiertas: la espera termina cuando se confirma, y ambas recargan una sola vez.
      const [bBefore, aBefore] = [lb.n, la.n];
      await a.getByRole('button', { name: 'Actualizar ahora' }).click();
      await expect(a.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026 v2');
      await expect(b.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026 v2');
      await a.waitForTimeout(2000);
      expect(la.n).toBe(aBefore + 1);
      expect(lb.n).toBe(bBefore + 1);
    } finally {
      await site.close();
    }
  });
});

test.describe('acceso familiar sin conexión', () => {
  test('tras autorizar una vez, la app abre sin conexión y sin pedir el correo', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.getByLabel('Correo electrónico').fill('Adriana.Cano.Mejia@gmail.com ');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.locator('a.card')).toHaveCount(4);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await expect.poll(() => controlled(page)).toBe(true);
      await ctx.setOffline(true);
      await page.reload();
      await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
      await expect(page.locator('a.card')).toHaveCount(4);
      await page.getByRole('link', { name: /Hotel/ }).click();
      await expect(page.getByText('2975 Arabian Nights Blvd, Kissimmee, FL 34747, Estados Unidos', { exact: true })).toBeVisible();
      // Recorrido (dentro de Calendario) disponible y con estado persistente sin conexión.
      await page.goto('/#/calendario/2026-12-10');
      await expect(page.getByRole('heading', { level: 2, name: /Recorrido: Mickey's Very Merry Christmas Party/ })).toBeVisible();
      await page.getByRole('checkbox', { name: /Fuegos artificiales navideños/ }).check();
      await page.reload();
      await expect(page.getByRole('checkbox', { name: /Fuegos artificiales navideños/ })).toBeChecked();
      await page.goto('/#/calendario/2026-12-09');
      await expect(page.locator('.it-item')).toHaveCount(17);
    } finally {
      await ctx.close();
    }
  });
  test('sin autorización previa tampoco hay acceso sin conexión a los datos', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto('/#/checklist');
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await expect.poll(() => controlled(page)).toBe(true);
      await ctx.setOffline(true);
      await page.reload();
      await expect(page.getByLabel('Correo electrónico')).toBeVisible();
      await expect(page.locator('a.card, #progress')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
