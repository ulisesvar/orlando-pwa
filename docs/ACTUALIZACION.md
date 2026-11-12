# Actualización de la PWA con confirmación (v1.1.2)

## Flujo

1. Al abrir la app con conexión se registra el Service Worker y se llama a `registration.update()`. También se comprueba cuando la app vuelve a primer plano (`visibilitychange`), como máximo **una vez cada 15 minutos** y solo con conexión (`MIN_CHECK_INTERVAL_MS` en `src/js/updater.js`).
2. Si hay una versión nueva, el Service Worker descarga **todos** sus recursos a una caché propia (`orlando-<hash>`) y queda en estado `waiting`. **No** se activa sola: `install` ya no llama a `skipWaiting()`.
3. Cuando la versión nueva está lista (`installed` con un controlador previo, o ya en `waiting` al abrir) aparece un aviso discreto, sin robar el foco: **«Nueva versión disponible»** con **«Actualizar ahora»** y **«Más tarde»**. Solo se muestra una vez por apertura.
4. **Actualizar ahora**: la página envía `{ type: 'SKIP_WAITING' }` y el Service Worker llama a `skipWaiting()`. Al activarse borra las cachés anteriores y toma el control (`clients.claim()`); la página recarga **una sola vez** en `controllerchange`.
5. **Más tarde**: el aviso se cierra y la app sigue sin interrupciones con la versión instalada. No se vuelve a mostrar en esa apertura; como la versión sigue en espera, se ofrece de nuevo en la siguiente apertura de la app.
6. **Sin conexión**: no se comprueba nada y la versión instalada sigue funcionando desde su caché. Una versión ya descargada y en espera sigue ofreciéndose.
7. La primera instalación (sin controlador previo) no muestra aviso ni recarga.

No hay que reinstalar la PWA ni borrar cachés. `localStorage` (acceso familiar, checklist y recorridos) no se toca.

## Coherencia

Cada versión sirve sus archivos solo de su propia caché y, mientras una versión espera, la activa no cambia. Al activar la nueva se recarga la página, de modo que HTML, JS y datos son siempre de la misma versión.

## Limitaciones

- **Transición desde v1.1.1 (única vez):** los clientes con v1.1.1 tienen el código antiguo, que no muestra el aviso. Al abrirlos, la versión 1.1.2 se descarga y queda en espera; se activa cuando se cierra por completo la app (todas las pestañas/ventanas) y se vuelve a abrir. Verificado localmente: tras cerrar y reabrir, la caché antigua se elimina y el checklist se conserva. Desde 1.1.2 en adelante rige el aviso.
- **Varias pestañas:** al confirmar en una, el nuevo Service Worker toma el control de todas y **todas recargan una vez**. Una pestaña con un formulario o marca sin guardar podría perder ese estado momentáneo (los datos guardados en `localStorage` no se pierden).
- **Más tarde** no se recuerda entre aperturas: es intencional para volver a ofrecerla, pero implica que el aviso reaparece cada vez hasta actualizar.
- El navegador decide cuándo revisa `sw.js` si la app no se abre; las comprobaciones propias solo ocurren con la app abierta o al volver a primer plano.
- iOS/Android: probado con Chromium (emulación); el comportamiento de cierre completo de una PWA instalada depende del sistema operativo y no se ha probado en dispositivos físicos.

## Pruebas

- `tests/unit/updater.test.js`: lógica con dobles (primera instalación, aviso único, «Más tarde», reapertura, una sola recarga, límite de frecuencia, sin conexión, errores).
- `tests/e2e/pwa.spec.mjs` (sitio temporal con v1 → v2): espera sin activación, aviso, «Más tarde», «Actualizar ahora» con una sola recarga y sin bucle, conservación del acceso/checklist/recorridos, offline con actualización pendiente y dos pestañas.
- `tests/e2e/a11y.spec.mjs`: axe del aviso en modo claro y oscuro y áreas táctiles ≥ 44 px.
- `tests/security/static.test.js`: `skipWaiting()` solo se invoca tras el mensaje de confirmación.
