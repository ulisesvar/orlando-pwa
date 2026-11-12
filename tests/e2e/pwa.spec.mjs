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
    for (const p of ['/js/auth.js', '/data/access.json', '/js/views.js', '/js/validate.js']) expect(cached).toContain(p);
    expect(cached).not.toContain('/sw.js');
  });

  test('funciona sin conexión tras la primera carga', async ({ page, context }) => {
    await installed(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');
    await expect(page.locator('.week-day')).toHaveCount(7);
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

test.describe('actualización del service worker', () => {
  test('una nueva versión reemplaza la caché anterior y sirve contenido coherente', async ({ browser }) => {
    const dir = mkdtempSync(join(tmpdir(), 'orlando-sw-'));
    cpSync('dist', dir, { recursive: true });
    const port = 4190 + Math.floor(Math.random() * 500);
    const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, SERVE_DIR: dir, PORT: String(port) }, stdio: 'ignore' });
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => localStorage.setItem('orlando-family-email-v1', 'ulises.vargas@gmail.com'));
    const page = await ctx.newPage();
    try {
      await expect
        .poll(
          async () => {
            try {
              return (await fetch(`http://127.0.0.1:${port}/`)).status;
            } catch {
              return 0;
            }
          },
          { timeout: 10000 },
        )
        .toBe(200);
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await expect.poll(() => controlled(page)).toBe(true);
      const before = (await page.evaluate(() => caches.keys()))[0];
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026');

      // Publicar "v2": nuevo id de build y título distinto en los datos.
      const sw = readFileSync(join(dir, 'sw.js'), 'utf8').replace(/const BUILD_ID = '[^']+'/, "const BUILD_ID = 'v2update0000'");
      writeFileSync(join(dir, 'sw.js'), sw);
      const trip = readFileSync(join(dir, 'data/trip.json'), 'utf8').replace('"title": "Orlando 2026"', '"title": "Orlando 2026 v2"');
      writeFileSync(join(dir, 'data/trip.json'), trip);

      await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        await r.update();
      });
      await expect.poll(() => page.evaluate(() => caches.keys()).catch(() => null), { timeout: 15000 }).toEqual(['orlando-v2update0000']);
      expect(before).not.toBe('orlando-v2update0000');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orlando 2026 v2'); // recarga automática con datos nuevos
    } finally {
      await ctx.close();
      srv.kill();
      rmSync(dir, { recursive: true, force: true });
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
      await expect(page.getByText('2975 Arabian Nights Blvd')).toBeVisible();
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
