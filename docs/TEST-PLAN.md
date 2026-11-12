# Plan de pruebas y resultados

Resultados **reales** de las ejecuciones locales (macOS, Node 24, Docker 28, Chromium de Playwright 1254) del 12-nov-2026. La verificación en GitHub Actions se reporta en el PR, no aquí.

## Cobertura

| Área | Dónde | Casos |
| --- | --- | --- |
| Validación de `trip.json` (esquema, claves, fechas reales, ids, longitudes) | `tests/unit/validate.test.js` | 14 |
| Fechas e itinerario (7 días, días de la semana, rangos, horas 12 h), vuelos, enlaces Waze/Maps | `tests/unit/trip-data.test.js` | 10 |
| Persistencia del checklist, datos corruptos, claves versionadas | `tests/unit/checklist.test.js` | 8 |
| Manejo de errores de almacenamiento | `tests/unit/storage.test.js` | 2 |
| Navegación (rutas válidas/manipuladas) | `tests/unit/router.test.js` | 4 |
| Seguridad estática: código, privacidad, secretos, Dockerfile/Compose/Nginx, workflows | `tests/security/static.test.js` | 26 |
| E2E: inicio (7 días, 4 tarjetas 2×2, táctil ≥ 44 px), vuelos, hotel, calendario por día, checklist (persistencia, reset con confirmación, teclado, `localStorage` bloqueado/corrupto), Atrás/recarga, teclado y foco, 0 errores JS | `tests/e2e/app.spec.mjs` | 14 × 2 proyectos |
| PWA: manifest e iconos, instalabilidad (CDP), precache, offline, no interceptar otros orígenes, **actualización del SW** | `tests/e2e/pwa.spec.mjs` | 6 × 2 |
| Accesibilidad: axe (WCAG 2.0/2.1/2.2 A/AA) en 6 rutas × claro/oscuro; `prefers-reduced-motion` | `tests/e2e/a11y.spec.mjs` | 13 × 2 |
| Seguridad en navegador/HTTP: cabeceras y CSP en cada ruta, caché, MIME, métodos, rutas no expuestas, CSP bloquea script inline, anti-iframe | `tests/security/headers.spec.mjs` (**solo contra Nginx**) | ver abajo |
| XSS por datos manipulados (JSON, hash, `localStorage`, enlaces) | `tests/security/xss.spec.mjs` | 6 × 2 |
| Contenedor: usuario, rootfs ro, caps, privilegios, mounts, puertos, logs, healthcheck, `3101` inaccesible desde IP LAN | `scripts/verify-container.sh` | 10 comprobaciones |

## Resultados

| Verificación | Resultado |
| --- | --- |
| `eslint .` / `prettier --check .` | Sin errores |
| `npm run validate:data` | `trip.json` válido |
| `vitest run` | **85 / 85 pasan** (8 archivos) |
| Playwright contra `dist/` servido por Node (mobile + desktop) | **77 pasan**, 69 omitidos (las pruebas de cabeceras exigen Nginx; 1 prueba exclusiva de móvil se omite en desktop) |
| `scripts/verify-container.sh` (imagen final + Compose endurecido + Playwright contra Nginx, mobile + desktop, e2e + security) | **145 pasan, 1 omitida** (la de columnas en móvil, que en el proyecto desktop no aplica); 0 fallos |
| Gitleaks (v8.30.1, imagen fijada por digest) sobre el repositorio | Sin fugas |
| Trivy `image` (CRÍTICO/ALTO, solo con parche disponible) sobre `orlando-pwa` | **Exit 0**. Una primera ejecución falló (base `1.28-alpine` obsoleta: 82 hallazgos); se corrigió pasando a `1.30-alpine` + `apk upgrade` |
| Trivy `fs` (vuln + misconfig, CRÍTICO/ALTO) | Exit 0 |
| `npm audit` | 4 avisos *moderados* en dev (`eslint`→`minimatch`); 0 altos/críticos; 0 en producción (no hay dependencias de producción) |

## Cómo ejecutar

```bash
npm ci && npx playwright install chromium
npm run lint && npm run validate:data && npm run test:unit
npm run test:e2e                 # contra dist/ con servidor Node
npm run test:container           # contra la imagen real con Nginx (requiere Docker; usa el puerto 3101)
```

## Limitaciones

- Solo Chromium; "móvil" es emulación de Pixel 7, **no se probó en dispositivos físicos** ni en Safari/iOS (instalación en pantalla de inicio de iOS sin verificar).
- La instalabilidad se verifica con el diagnóstico de Chromium (`Page.getInstallabilityErrors`), no con el diálogo de instalación real.
- No se verificó TLS/HSTS/Cloudflare Access (fuera del repositorio).
- CI en GitHub Actions (último run del PR #1): los 6 jobs pasan (lint, unitarias, E2E+a11y+seguridad, Gitleaks, dependencias, imagen Docker con Trivy, SBOM y verificación del contenedor). El workflow Release no se ha ejecutado.
