import { test, expect } from '@playwright/test';

// Estas pruebas requieren el Nginx real: BASE_URL=http://127.0.0.1:3101 (ver scripts/verify-container.sh).
test.skip(!process.env.BASE_URL, 'requiere BASE_URL apuntando al contenedor Nginx');

const PATHS = [
  '/',
  '/index.html',
  '/sw.js',
  '/manifest.webmanifest',
  '/data/trip.json',
  '/js/main.js',
  '/css/app.css',
  '/icons/icon-192.png',
  '/nope',
];

test.describe('cabeceras HTTP', () => {
  for (const p of PATHS) {
    test(`cabeceras de seguridad en ${p}`, async ({ request }) => {
      const h = (await request.get(p)).headers();
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['permissions-policy']).toMatch(/camera=\(\)/);
      expect(h['permissions-policy']).toMatch(/geolocation=\(\)/);
      expect(h['cross-origin-opener-policy']).toBe('same-origin');
      expect(h['server']).toBe('nginx'); // sin versión
      const csp = h['content-security-policy'];
      for (const d of [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "form-action 'none'",
      ])
        expect(csp).toContain(d);
      expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:/);
    });
  }
  test('política de caché por tipo de archivo', async ({ request }) => {
    for (const p of ['/', '/sw.js', '/data/trip.json', '/manifest.webmanifest', '/js/main.js'])
      expect((await request.get(p)).headers()['cache-control'], p).toBe('no-cache');
    expect((await request.get('/icons/icon-192.png')).headers()['cache-control']).toBe('public, max-age=86400');
  });
  test('no emite HSTS (lo gestiona Cloudflare)', async ({ request }) => {
    expect((await request.get('/')).headers()['strict-transport-security']).toBeUndefined();
  });
  test('tipos MIME correctos', async ({ request }) => {
    const ct = async (p) => (await request.get(p)).headers()['content-type'];
    expect(await ct('/')).toMatch(/^text\/html/);
    expect(await ct('/js/main.js')).toMatch(/javascript/);
    expect(await ct('/manifest.webmanifest')).toMatch(/^application\/manifest\+json/);
    expect(await ct('/data/trip.json')).toMatch(/^application\/json/);
  });
  test('métodos distintos de GET/HEAD se rechazan', async ({ request }) => {
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) expect((await request.fetch('/', { method: m })).status(), m).toBe(405);
  });
  test('/healthz responde', async ({ request }) => {
    const r = await request.get('/healthz');
    expect(r.status()).toBe(200);
  });
});

test.describe('rutas y archivos no expuestos', () => {
  for (const p of [
    '/.git/config',
    '/.env',
    '/.gitignore',
    '/package.json',
    '/package-lock.json',
    '/Dockerfile',
    '/infra/nginx.conf',
    '/infra/compose.yaml',
    '/tests/unit/validate.test.js',
    '/docs/SECURITY.md',
    '/scripts/build.mjs',
    '/node_modules/',
    '/src/index.html',
    '/.github/workflows/ci.yml',
    '/data/',
    '/js/',
    '/%2e%2e/etc/passwd',
  ]) {
    test(`404/403/400 en ${p}`, async ({ request }) => {
      const s = (await request.get(p, { maxRedirects: 0 })).status();
      expect([400, 403, 404]).toContain(s);
    });
  }
  test('sin listado de directorios', async ({ request }) => {
    const b = await (await request.get('/js/')).text();
    expect(b).not.toMatch(/Index of|main\.js/);
  });
});

test('CSP bloquea scripts inline inyectados (prueba en navegador)', async ({ page }) => {
  const violations = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  await page.goto('/');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = 1';
    document.body.append(s);
  });
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(violations.length).toBeGreaterThan(0);
});

test('no se puede incrustar en un iframe', async ({ page, baseURL }) => {
  await page.goto('about:blank');
  const blocked = await page.evaluate(
    async (u) =>
      new Promise((res) => {
        const f = document.createElement('iframe');
        f.src = u;
        f.onload = () => res(f.contentDocument === null || f.contentWindow.location.href === 'about:blank' ? 'blocked' : 'loaded');
        document.body.append(f);
        setTimeout(() => res('timeout'), 4000);
      }),
    baseURL,
  );
  expect(['blocked']).toContain(blocked);
});
