# Itinerarios de Magic Kingdom (v1.1.0)

Dos itinerarios independientes: **miércoles 9 de diciembre de 2026** (Magic Kingdom) y **jueves 10 de diciembre de 2026** (Mickey's Very Merry Christmas Party). Rutas: `#/itinerarios`, `#/itinerarios/2026-12-09`, `#/itinerarios/2026-12-10`.

## Diseño

- Datos: `src/data/itineraries.json` (archivo propio; `trip.json`, vuelos, hotel y acceso no se tocan). Validación estricta en `src/js/itinerary.js` (claves desconocidas, categorías, prioridades, orden cronológico, ids únicos, URLs `https`).
- Cada actividad tiene hora (`start`) y etiqueta mostrada (`label`, p. ej. `~19:00` o `20:00–21:00`), nombre, descripción, zona, categoría (traslado, atracción, personaje, comida, descanso, espectáculo), prioridad (imprescindible, recomendada, opcional), bandera `provisional`, observaciones y alternativa. Las actividades sin hora («Última hora», «Al terminar») van al final.
- Estado: pendiente / completada / omitida, por actividad y por día, en `localStorage` bajo `orlando2026:itinerary:v1` (`{ v: 1, days: { fecha: { idActividad: 'done' | 'skipped' } } }`). «Pendiente» es la ausencia de entrada. Es una clave distinta de la del checklist (`orlando2026:checklist:v1`), que no se lee ni se modifica. Estado corrupto o con ids ajenos se ignora.
- «Siguiente» es la primera actividad pendiente en orden cronológico (no depende del reloj del teléfono).
- Offline: `scripts/build.mjs` precachea todo `dist/`, por lo que `itineraries.json` y `itinerary.js` entran en el Service Worker y su hash de caché cambia. Los enlaces a fuentes oficiales son solo informativos y no se necesitan para mostrar el itinerario.
- Si `itineraries.json` es inválido o no carga, solo esa sección muestra un error; el resto de la app sigue funcionando.

## Correcciones respecto al borrador original

- 20:00–21:00 del día 10 ya no lista cuatro atracciones como simultáneas: es un bloque «elegir según filas» con la observación de que no caben todas.
- El primer desfile (~20:30) iba antes del bloque 20:00 en la tabla; ahora está después, en orden cronológico, y se marca como omitido a propósito (opcional).
- «Acceso a la fiesta» a las 16:00 se describe como entrada anticipada con el boleto; la fiesta propiamente dicha es de 19:00 a 00:00 según Disney.

## Verificación contra fuentes oficiales (consultadas el 12 de noviembre de 2026)

Confirmado en disneyworld.disney.go.com:

- La fiesta se celebra el 10 de diciembre; horario 19:00–00:00; entrada al parque con boleto de la fiesta desde las 16:00.
- «Minnie's Wonderful Christmastime Fireworks» figura con inicio a las 22:00 (puede ser una función de ejemplo; confirmar).
- Rider Switch: figuran Seven Dwarfs Mine Train, Space Mountain y The Barnstormer. Buzz Lightyear y PeopleMover **no** se afirman como elegibles.
- El encuentro con Minnie en Pete's Silly Sideshow y el de Mickey en Town Square Theater existen como experiencias de personajes; Disney ubica el primero en Fantasyland.

## Pendiente de confirmar (todo se muestra como provisional)

- Horario de apertura y de entrada anticipada del 9 de diciembre.
- Horas del primer y segundo desfile del 10 de diciembre y confirmación del horario de los fuegos (22:00).
- Disponibilidad y horarios de Minnie en Pete's Silly Sideshow, de Mickey y de Mickey y Minnie navideños el 10 de diciembre; presencia de Santa Claus en Storybook Circus.
- Horarios de Tiki Room / Country Bear Musical Jamboree.
- Operación del ferry y del monorriel esos días.
- No se publican tiempos de espera ni duraciones de recorridos.

Supuestos: las horas de la tabla original se conservan como orden orientativo; las prioridades (imprescindible / recomendada / opcional) son propuesta mía y deben revisarse con la familia; Barnstormer y Dumbo se ubican en Storybook Circus.

## Validación manual (móvil)

1. Abrir la app, entrar con un correo autorizado y tocar «Itinerarios». Deben aparecer los dos días con su fecha.
2. Entrar al 9 de diciembre: lista de 17 actividades desde 07:45 hasta «Última hora», con prioridad y categoría visibles y el aviso de horarios orientativos.
3. Marcar la primera como «Completada» y la segunda como «Omitida». Debe cambiar el contador y «Siguiente».
4. Cerrar y reabrir la app: el estado se conserva.
5. Cambiar al 10 de diciembre: todo sigue pendiente (independiente). Los desfiles, fuegos y encuentros llevan «Horario provisional».
6. Activar modo avión y reabrir: los itinerarios y su estado siguen disponibles.
7. Comprobar que el checklist conserva sus marcas.
8. Pendiente en dispositivos físicos (iPhone y Android): las pruebas automáticas usan Chromium con emulación móvil.

## Evidencia visual

Capturas con emulación Pixel 7 (Chromium) con la primera actividad completada y la segunda omitida:

- `docs/itinerario-movil-2026-12-09.png`
- `docs/itinerario-movil-2026-12-10.png`
