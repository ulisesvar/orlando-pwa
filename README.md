# Orlando 2026

PWA familiar para el viaje a Orlando (5–11 de diciembre de 2026): resumen semanal, vuelos, hotel con enlaces a Waze/Google Maps, calendario por día y checklist. HTML + CSS + JavaScript nativo (módulos ES), sin framework, sin backend, sin analítica. Funciona sin conexión tras la primera carga.

Producción: `https://viaje.canumpe.com` (imagen Nginx sin privilegios publicada en `ghcr.io/ulisesvar/orlando-pwa`).

> El sitio es **públicamente legible** hasta que se configure y verifique Cloudflare Access. No incluye datos de reservación ni personales.

## Requisitos

Node.js ≥ 22, npm, Docker (para la imagen y la verificación del contenedor).

## Comandos

| Comando                  | Qué hace                                                                      |
| ------------------------ | ----------------------------------------------------------------------------- |
| `npm ci`                 | Instala dependencias de desarrollo (no hay dependencias de producción)        |
| `npm run build`          | Copia `src/` a `dist/` y estampa el Service Worker (hash + lista de precache) |
| `npm run serve`          | Sirve `dist/` en `http://127.0.0.1:4173` (solo desarrollo)                    |
| `npm run validate:data`  | Valida `src/data/trip.json` contra el esquema                                 |
| `npm run lint`           | ESLint + Prettier                                                             |
| `npm run test:unit`      | Vitest: unitarias + seguridad estática                                        |
| `npm run test:e2e`       | Playwright (móvil y escritorio): E2E, PWA/offline, accesibilidad (axe)        |
| `npm run test:container` | Construye la imagen, la levanta con Compose endurecido y corre E2E + seguridad contra Nginx |
| `npm run audit`          | `npm audit` (umbral alto)                                                     |

La primera vez: `npx playwright install chromium`.

## Estructura

```
src/            app (index.html, js/, css/, data/trip.json, sw.js, manifest, iconos)
tests/unit      lógica (validación, fechas, checklist, router, enlaces, storage)
tests/e2e       flujos de usuario, PWA/offline, accesibilidad
tests/security  cabeceras, rutas, XSS, hardening estático
infra/          nginx.conf y compose.yaml
scripts/        build, servidor de desarrollo, iconos, verificación del contenedor
docs/           ARCHITECTURE, SECURITY, TEST-PLAN, DEPLOYMENT, ROLLBACK, ITINERARIOS, ACTUALIZACION
```

## Actualizar el itinerario

Edite solo `src/data/trip.json`, ejecute `npm run validate:data` y abra un PR. Al fusionar y publicar una release, el build calcula un hash nuevo y el Service Worker reemplaza la caché anterior. Detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#actualizar-tripjson-y-generar-una-versión) y [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentación

[Arquitectura](docs/ARCHITECTURE.md) · [Seguridad y matriz ASVS](docs/SECURITY.md) · [Plan de pruebas](docs/TEST-PLAN.md) · [Despliegue](docs/DEPLOYMENT.md) · [Rollback](docs/ROLLBACK.md)

## Créditos

La fotografía de portada (`src/img/orlando-castillo-*.webp`) es un recorte 16:9, redimensionado y convertido a WebP, de «Magic Kingdom – Cinderella Castle panorama» de Michael Gray (Flickr: kathika), publicada en [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Magic_Kingdom_-_Cinderella_Castle_panorama_-_by_mrkathika.jpg) bajo licencia [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Las versiones derivadas se distribuyen bajo la misma licencia. Disney, Magic Kingdom y Cinderella Castle son marcas de sus titulares; este proyecto es familiar y no tiene afiliación con ellos.
