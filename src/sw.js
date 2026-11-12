// Service Worker. El marcador de build lo sustituye scripts/build.mjs con un hash del contenido,
// de modo que cualquier cambio de HTML/JS/JSON produce una caché nueva y coherente.
const BUILD_ID = '__BUILD_ID__';
const CACHE = `orlando-${BUILD_ID}`;
const PRECACHE = '__PRECACHE__';

const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = JSON.parse(PRECACHE).map((p) => new URL(p, SCOPE).href);
      await cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })));
      // Sin skipWaiting aquí: la versión nueva queda en espera hasta que la persona confirme (mensaje SKIP_WAITING).
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('orlando-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// La página pide la activación solo tras «Actualizar ahora». Se ignora cualquier otro mensaje.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = req.mode === 'navigate' ? new URL('./', SCOPE).href : req.url;
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch {
        return req.mode === 'navigate' ? ((await cache.match(new URL('./', SCOPE).href)) ?? Response.error()) : Response.error();
      }
    })(),
  );
});
