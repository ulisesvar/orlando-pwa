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
- **Datos no confirmados se omiten**: los horarios de check-in/out del hotel están en `null` y no se muestran. La dirección confirmada (2975 Arabian Nights Blvd, Kissimmee, FL 34747) alimenta los enlaces de Waze y Google Maps.
- **Acceso familiar (v1.0.1)**: `src/js/auth.js` + `src/data/access.json`. El correo se pide una vez por dispositivo, se compara normalizado (minúsculas, sin espacios exteriores) y se recuerda en `localStorage` (`orlando-family-email-v1`). Si el almacenamiento está bloqueado, el acceso vive solo en memoria. «Cambiar usuario» borra únicamente esa clave, no el checklist. Todo se precachea, por lo que funciona sin conexión.
- **Checklist por dispositivo**: sin cuentas ni sincronización.

## Service Worker y versiones coherentes

`scripts/build.mjs` copia `src/` a `dist/`, calcula un hash SHA-256 de todo el contenido y lo escribe como `BUILD_ID` en `sw.js`, junto con la lista de precache. La caché se llama `orlando-<hash>`.

1. `install`: descarga **todos** los recursos de la versión nueva a su propia caché (`cache: 'reload'`) y **queda en espera** (`waiting`): no se activa sola.2. Confirmación: tras «Actualizar ahora» la página envía `SKIP_WAITING` y el Service Worker llama a `skipWaiting()` (único punto donde se llama).
3. `activate`: borra cualquier caché `orlando-*` distinta y toma el control.
4. `fetch`: solo `GET` del mismo origen y dentro del scope; sirve únicamente de la caché de la versión activa y, si falta, de la red. No cachea en tiempo de ejecución (nada de otros dominios ni de rutas ajenas).
5. `src/js/updater.js` recarga una vez en `controllerchange` (no en la primera instalación), de modo que HTML, JS y JSON nunca se mezclan entre versiones. El estado local (`localStorage`) sobrevive. Detalle en [ACTUALIZACION.md](ACTUALIZACION.md).

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

- **Recorrido dentro de Calendario (v1.1.0)**: `src/data/itineraries.json` + `src/js/itinerary.js`, con estado propio en `orlando2026:itinerary:v1`. Ver [ITINERARIOS.md](ITINERARIOS.md).
- **Portada (v1.1.x)**: fotografía decorativa local en `src/img/` (WebP 640/960/1280 px, 16:9, `srcset`, `alt=""`, no enlazada). Se precachea con el resto de `dist/`, por lo que funciona sin conexión. Reemplaza la tira de resumen semanal del inicio; esa información sigue en Calendario. Créditos y licencia en el README.
