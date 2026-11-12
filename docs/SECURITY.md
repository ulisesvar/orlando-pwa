# Seguridad

Referencia: **OWASP ASVS 5.0.0** (identificadores con formato `v5.0.0-<capítulo>.<sección>.<requisito>`, tomados del JSON oficial `OWASP/ASVS` tag `v5.0.0`). Se evaluaron los requisitos de nivel 1 (L1).

## Modelo de amenazas

| Activo                                                      | Amenaza                                                    | Control principal                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Integridad del sitio / dispositivos de la familia           | XSS por datos manipulados (`trip.json`, `localStorage`, hash) | Validación estricta + DOM seguro + CSP `script-src 'self'`       |
| Itinerario (baja sensibilidad, públicamente legible)        | Lectura por terceros con la URL                            | Datos mínimos, sin PII; **riesgo aceptado** hasta Cloudflare Access |
| Servidor Canumpe                                            | Escape de contenedor / escalada                            | No root, rootfs ro, `cap_drop ALL`, `no-new-privileges`, sin socket Docker, solo `127.0.0.1` |
| Cadena de suministro                                        | Acción/imagen/dependencia comprometida                     | Acciones por SHA, base por digest, lockfile, Trivy, Gitleaks, SBOM, procedencia |
| Usuarios                                                    | Clickjacking, MIME sniffing, fuga de referrer              | `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer` |

Fuera de alcance: autenticación, sesiones, cuentas, pagos (la app no los tiene).

## Matriz de trazabilidad ASVS 5.0.0 (L1)

Estados: **Cumple** (control + evidencia ejecutada), **Delegado** (cumplido por otra capa, documentado), **N/A**.

| ID ASVS            | Requisito (resumen)                                          | Riesgo                              | Control implementado                                                                 | Prueba / evidencia                                                                                       | Estado   |
| ------------------ | ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- |
| v5.0.0-1.2.1       | Codificación de salida según contexto (HTML)                 | Inyección en el documento           | Todo texto se inserta con `textContent`; no hay HTML como cadena                      | `tests/security/static.test.js` (sin innerHTML); `xss.spec.mjs` (payload literal)                        | Cumple   |
| v5.0.0-1.2.2       | URLs dinámicas: codificar datos y permitir solo protocolos seguros | Redirección / `javascript:`      | `links.js` usa `encodeURIComponent` sobre host fijo `https://`; los datos no aportan URLs | `trip-data.test.js` (enlaces, consulta maliciosa); `xss.spec.mjs`; `app.spec` (rel/target)               | Cumple   |
| v5.0.0-1.2.3       | Codificación al construir JS/JSON dinámico                   | Inyección JS/JSON                   | No se construye JS ni JSON como texto; `JSON.parse`/`JSON.stringify` únicamente       | Revisión de `src/js`; ESLint `no-eval/no-new-func`                                                       | Cumple   |
| v5.0.0-1.3.2       | Sin `eval()` ni ejecución dinámica                           | Ejecución de código                 | ESLint (`no-eval`, `no-new-func`, `no-implied-eval`) y CSP sin `unsafe-eval`          | `static.test.js` (sin eval/Function/setTimeout-string); `headers.spec` (CSP sin unsafe-*)                 | Cumple   |
| v5.0.0-2.1.1       | Documentar reglas de validación de entrada                   | Datos inválidos                     | Reglas definidas en `validate.js` y descritas en `docs/ARCHITECTURE.md`               | Este documento + `validate.test.js`                                                                      | Cumple   |
| v5.0.0-2.2.1       | Validación positiva (allow-list/estructura) de la entrada    | Datos manipulados                   | Validador estricto: claves exactas, tipos, longitudes, fechas reales, ids, horas      | `validate.test.js` (14 casos); `xss.spec.mjs` (esquema violado → error); `validate:data` en CI           | Cumple   |
| v5.0.0-2.2.2       | Validación en una capa de servicio de confianza              | Control solo del lado cliente       | No hay servicio: `trip.json` es contenido estático propio y se valida en el cliente **y** en CI (`validate:data`) antes de publicar | CI job `unit`                                                                                            | Cumple (con matiz) — no existe capa servidor; la fuente es el repo revisado por PR |
| v5.0.0-3.2.1       | Evitar que el navegador renderice contenido en contexto incorrecto | Sniffing / contexto erróneo    | `X-Content-Type-Options: nosniff`, MIME correctos, `default-src 'none'`               | `headers.spec.mjs` (cabeceras y tipos MIME en cada ruta)                                                 | Cumple   |
| v5.0.0-3.2.2       | Texto mostrado con funciones seguras (`textContent`)         | XSS DOM                             | `dom.js::h()` solo `createElement`/`append`/`setAttribute` con valores validados      | `xss.spec.mjs` (6 escenarios); `static.test.js`                                                          | Cumple   |
| v5.0.0-3.3.1       | Cookies con `Secure`/prefijo                                 | Robo de cookies                     | La app no usa cookies                                                                 | `static.test.js` (sin `document.cookie`); sin `Set-Cookie` en respuestas                                 | N/A      |
| v5.0.0-3.4.1       | HSTS en todas las respuestas (≥ 1 año)                       | Downgrade HTTP                      | Se emite en el borde de Cloudflare (Always HTTPS/HSTS); **no** en el origen para no contradecir al proxy ni afectar otros subdominios | `headers.spec.mjs` verifica que el origen no emite HSTS; **verificar en Cloudflare** (ver pendientes)     | Delegado |
| v5.0.0-3.4.2       | CORS: `Access-Control-Allow-Origin` fijo o con allow-list    | Lectura cross-origin                | No se emite ninguna cabecera CORS; `Cross-Origin-Resource-Policy: same-origin`        | `headers.spec.mjs`                                                                                       | Cumple   |
| v5.0.0-3.5.3       | Métodos HTTP apropiados para funcionalidad sensible          | CSRF por GET                        | No hay funcionalidad sensible; Nginx solo admite `GET`/`HEAD` (405 al resto)          | `headers.spec.mjs` (POST/PUT/DELETE/PATCH → 405)                                                         | Cumple   |
| v5.0.0-4.1.1       | `Content-Type` correcto con charset en cada respuesta        | MIME confusion                      | `mime.types` + `webmanifest` + `charset utf-8`                                        | `headers.spec.mjs` (tipos MIME)                                                                          | Cumple   |
| v5.0.0-8.1.1       | Documentar reglas de autorización                            | Acceso indebido                     | Sin cuentas ni autorización: toda la app es pública por diseño; la restricción real será Cloudflare Access | Este documento                                                                                           | Cumple (documentado) — control de acceso pendiente en Cloudflare |
| v5.0.0-12.1.1      | Solo TLS 1.2/1.3                                             | Cifrado débil                       | Terminación TLS en Cloudflare                                                         | Configuración de Cloudflare (no verificada desde este repositorio)                                       | Delegado |
| v5.0.0-12.2.1      | TLS en toda conexión cliente–servicio externo                | Texto plano                         | Cloudflare Tunnel; el origen escucha solo en loopback                                 | `verify-container.sh` (puerto no accesible desde IP LAN); Compose `127.0.0.1:3101`                       | Delegado |
| v5.0.0-12.2.2      | Certificados TLS públicamente confiables                     | MITM                                | Certificado gestionado por Cloudflare                                                 | No verificable desde el repositorio                                                                      | Delegado |
| v5.0.0-13.4.1      | Sin metadatos de control de versiones accesibles             | Fuga de código/secretos             | `.dockerignore` excluye `.git`; la imagen solo contiene `dist/`; Nginx 404 a dotfiles | `headers.spec.mjs` (`/.git/config`, `/.env`, `/package.json`, `/infra/…` → 404)                          | Cumple   |
| v5.0.0-14.2.1      | Datos sensibles fuera de URL/query                           | Fuga por URL/logs                   | La app no maneja datos sensibles; las URLs solo contienen fechas; Referrer-Policy `no-referrer` | `router.test.js`; `headers.spec.mjs`                                                                      | Cumple   |
| v5.0.0-14.3.1      | Limpiar datos autenticados del cliente al terminar sesión    | Persistencia de datos               | No hay sesión ni datos autenticados; `localStorage` solo guarda ids de checklist (sin credenciales) | `checklist.test.js`; `static.test.js` (sin password/token)                                               | N/A      |
| v5.0.0-15.1.1      | Documentar plazos de remediación de componentes vulnerables  | Componentes obsoletos               | Política abajo: crítico/alto ≤ 7 días, medio ≤ 30 días; sin dependencias de producción; Dependabot no habilitado (revisión manual en cada release) | Este documento; `npm run audit` + Trivy en CI                                                            | Cumple   |
| v5.0.0-15.2.1      | Solo componentes dentro de los plazos de remediación         | Vulnerabilidades conocidas          | Escaneo bloqueante de `npm audit` (alto) y Trivy (CRÍTICO/ALTO) en CI y release       | CI jobs `dependencies` y `docker`                                                                        | Cumple (ver riesgos: 4 avisos moderados solo en dev) |
| v5.0.0-15.3.1      | Devolver solo el subconjunto necesario de campos             | Exposición excesiva                 | `trip.json` contiene únicamente lo que la UI muestra; sin reservas, teléfonos ni correos | `static.test.js` (privacidad de datos)                                                                   | Cumple   |

### Requisitos L1 evaluados como no aplicables

| Capítulo ASVS | Justificación |
| --- | --- |
| V4.4 (WebSocket), V17 (WebRTC) | No se usan WebSockets ni WebRTC. |
| V5 (archivos) | No hay carga ni procesamiento de archivos por el usuario. |
| V6 (autenticación), V7 (sesiones), V9 (tokens), V10 (OAuth/OIDC) | No hay cuentas, sesiones, tokens ni OAuth. El control de acceso previsto (Cloudflare Access) es externo. |
| V8.2, V8.3 | Sin autorización de función/datos: contenido único y público. |
| V1.2.4, V1.2.5, V1.3.1, V1.5.1 | Sin base de datos, comandos del SO, editores WYSIWYG ni XML. |
| V2.3.1 | Sin flujos de lógica de negocio secuenciales. |
| V11 (criptografía) | La app no implementa criptografía. |

## Cabeceras (Nginx, `infra/nginx.conf`)

- `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (verificada con la app, el manifest y el Service Worker en ejecución: 0 errores de consola).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva, `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy: same-origin`.
- `Cache-Control: no-cache` (revalidación) para HTML/JS/CSS/JSON/SW/manifest; `public, max-age=86400` para iconos.
- Sin HSTS en el origen (ver 3.4.1).

## Política de remediación de componentes (v5.0.0-15.1.1)

| Severidad | Plazo |
| --- | --- |
| Crítica / Alta | 7 días (bloquea CI y release) |
| Media | 30 días |
| Baja | Siguiente release |

La imagen base (`nginx-unprivileged:1.30-alpine`, `node:22-alpine` solo para el build) está fijada por digest y se actualiza manualmente al revisar avisos o antes de cada release. Además, el Dockerfile ejecuta `apk upgrade` para incorporar parches de Alpine posteriores al digest; por eso dos builds en fechas distintas pueden diferir y **la identidad inmutable de la release es el digest de la imagen publicada**.

## Riesgos residuales

1. **Contenido públicamente legible** hasta configurar y verificar Cloudflare Access. No se simula protección ocultando rutas o JSON. Los datos publicados no incluyen PII ni reservas, pero sí fechas, vuelos y hotel de la familia.
2. **TLS/HSTS dependen de Cloudflare**; no se pudieron verificar desde este repositorio.
3. **Datos del hotel sin confirmar** (dirección y horarios de check-in/out en `null`); las fuentes públicas se contradicen.
4. **`npm audit`** reporta 4 avisos *moderados* en la cadena de desarrollo (`eslint` → `minimatch`). No llegan a la imagen (sin dependencias de producción) y no superan el umbral (alto) del CI.
5. **Dependencias de CI de terceros** (acciones de GitHub): fijadas por SHA, pero hay que actualizarlas manualmente.
6. **Sin firma de imagen** (cosign); se emite atestación de procedencia de GitHub (`actions/attest-build-provenance`) y SBOM, que debe verificarse en la primera release.
7. Pruebas en navegador solo con Chromium (emulación de móvil); no se probó en dispositivos físicos ni en Safari/Firefox.
