# Arquitectura

Objetivo: una app pequeña, verificable y mantenible. Sin backend, API, base de datos ni autenticación propia.

## Componentes

| Módulo (`src/js/`) | Responsabilidad                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `validate.js`      | Validador estricto del esquema de `trip.json` (claves desconocidas rechazadas, límites, fechas reales) |
| `dates.js`         | Fechas/horas en español sin depender de `Intl` ni de la zona horaria del dispositivo             |
| `links.js`         | Genera enlaces Waze/Google Maps a partir de texto validado y codificado; los datos nunca aportan URLs |
| `router.js`        | Rutas por hash (`#/vuelos`, `#/calendario/2026-12-10`…): Atrás, enlaces y recarga sin servidor    |
| `checklist.js`     | Lógica del checklist (sin DOM): estado en `localStorage`, clave versionada `orlando2026:checklist:v1` |
| `storage.js`       | Envoltorio de `localStorage` con `try/catch` y respaldo en memoria                               |
| `dom.js`           | `h()` e iconos SVG locales; solo `createElement`/`textContent`, jamás HTML como cadena           |
| `views.js`         | Presentación: funciones que devuelven nodos DOM                                                  |
| `main.js`          | Arranque: carga y valida datos, conecta router/checklist, registra el Service Worker             |

Datos: `src/data/trip.json` (única fuente). Estilos: `src/css/app.css` (tokens, claro/oscuro, `prefers-reduced-motion`).

## Decisiones

- **Ruteo por hash**: el servidor solo sirve archivos estáticos; no hay reescrituras ni 404 especiales, y el Service Worker solo necesita precachear `./`.
- **Sin framework**: ~10 módulos pequeños; el costo de un framework no se justifica.
- **Datos no confirmados se omiten**: aeropuerto/zona horaria de origen del viaje, dirección exacta y horarios de check-in/out del hotel están en `null` y la UI dice «Por confirmar». Las fuentes consultadas se contradicen (p. ej. 2975 Arabian Nights Blvd vs. 3001 Parkway Blvd), así que los mapas buscan por nombre y ciudad.
- **Checklist por dispositivo**: sin cuentas ni sincronización.

## Service Worker y versiones coherentes

`scripts/build.mjs` copia `src/` a `dist/`, calcula un hash SHA-256 de todo el contenido y lo escribe como `BUILD_ID` en `sw.js`, junto con la lista de precache. La caché se llama `orlando-<hash>`.

1. `install`: descarga **todos** los recursos de la versión nueva a su propia caché (`cache: 'reload'`) y hace `skipWaiting`.
2. `activate`: borra cualquier caché `orlando-*` distinta y toma el control.
3. `fetch`: solo `GET` del mismo origen y dentro del scope; sirve únicamente de la caché de la versión activa y, si falta, de la red. No cachea en tiempo de ejecución (nada de otros dominios ni de rutas ajenas).
4. `main.js` recarga una vez en `controllerchange` (no en la primera instalación), de modo que HTML, JS y JSON nunca se mezclan entre versiones. El estado del checklist vive en `localStorage` y sobrevive.

`sw.js` se sirve `no-cache`, por lo que el navegador detecta versiones nuevas en cada carga.

## Límites

- Nginx solo sirve estáticos (`GET`/`HEAD`), puerto 8080 sin privilegios, rootfs de solo lectura, `/tmp` en tmpfs.
- HTTPS/HSTS los gestiona Cloudflare; el origen escucha solo en `127.0.0.1:3101`.
- No hay control de acceso en la app: cualquier persona con la URL puede leer los datos hasta que exista Cloudflare Access.

## Actualizar `trip.json` y generar una versión

1. Edite `src/data/trip.json` (rama nueva). Reglas: fechas `AAAA-MM-DD` dentro del rango y en orden; horas `HH:MM` 24 h; textos con límites de longitud; `null` para datos no confirmados; ids únicos del checklist (minúsculas, dígitos y guiones).
2. `npm run validate:data && npm run test:unit` (las pruebas fijan el itinerario actual: si el cambio es intencional, actualice también `tests/unit/trip-data.test.js` y `tests/e2e`).
3. PR → CI en verde → fusionar a `main`.
4. Actions → **Release** → *Run workflow* con la versión (p. ej. `1.0.1`). El resumen del job entrega la referencia por digest.
5. Siga [DEPLOYMENT.md](DEPLOYMENT.md).
