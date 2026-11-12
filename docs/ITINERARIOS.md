# Recorrido de Magic Kingdom (v1.1.0)

Dos itinerarios independientes: **miércoles 9 de diciembre de 2026** (Magic Kingdom) y **jueves 10 de diciembre de 2026** (Mickey's Very Merry Christmas Party). **«Recorrido» es una subsección de Calendario**, justo debajo de la agenda del día seleccionado: `#/calendario/2026-12-09` muestra el recorrido de Magic Kingdom y `#/calendario/2026-12-10` el de la fiesta navideña. Cualquier otra fecha (y `#/calendario` sin fecha, que abre el 5 de diciembre) muestra solo la agenda. No hay tarjeta propia en el inicio ni una segunda navegación por fechas: la fecha elegida en Calendario determina el recorrido. Las rutas heredadas `#/itinerarios` y `#/itinerarios/AAAA-MM-DD` redirigen a `#/calendario` y `#/calendario/AAAA-MM-DD`.

## Diseño

- Datos: `src/data/itineraries.json` (archivo propio; `trip.json`, vuelos, hotel y acceso no se tocan). Validación estricta en `src/js/itinerary.js` (claves desconocidas, categorías, prioridades, orden cronológico, ids únicos, URLs `https`).
- Cada actividad tiene hora (`start`) y etiqueta mostrada (`label`, p. ej. `~19:00` o `20:00–21:00`), nombre, descripción, zona, categoría (traslado, atracción, personaje, comida, descanso, espectáculo), prioridad (imprescindible, recomendada, opcional), bandera `provisional`, observaciones y alternativa. Las actividades sin hora («Última hora», «Al terminar») van al final.
- Estado: **una casilla por actividad** (marcada = realizada, desmarcada = pendiente), por día, en `localStorage` bajo `orlando2026:itinerary:v1` (`{ v: 1, days: { fecha: { idActividad: 'done' } } }`). Pendiente es la ausencia de entrada.
- Migración: el formato `v: 1` no cambia. Los valores `skipped` guardados por la versión anterior del PR se leen como pendientes y se descartan en el siguiente guardado; las `done` se conservan. La clave es distinta de la del checklist (`orlando2026:checklist:v1`), que no se lee ni se modifica. Estado corrupto o con ids ajenos se ignora.
- «Siguiente» es la primera actividad pendiente en orden cronológico (no depende del reloj del teléfono).
- Offline: `scripts/build.mjs` precachea todo `dist/`, por lo que `itineraries.json` y `itinerary.js` entran en el Service Worker y su hash de caché cambia. Los enlaces a fuentes oficiales son solo informativos y no se necesitan para mostrar el itinerario.
- Si `itineraries.json` es inválido o no carga, Calendario sigue mostrando su agenda y simplemente no aparece el recorrido.
- En los días con recorrido se omite la nota «No hay horarios definidos para las actividades», porque el recorrido ya trae horarios (provisionales cuando aplica).

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

1. Abrir la app y entrar con un correo autorizado. El inicio debe tener cuatro tarjetas (Vuelos, Hotel, Calendario, Checklist), sin «Recorrido».
2. Calendario → Miércoles 9: bajo la agenda aparece «Recorrido: Magic Kingdom» con 17 actividades desde 07:45 hasta «Última hora», prioridad y categoría visibles y el aviso de horarios orientativos.
3. Marcar las dos primeras actividades (la casilla o cualquier parte de la tarjeta). Debe cambiar «Realizadas: X de N», la barra y «Siguiente». Desmarcar una la devuelve a pendiente.
4. Cerrar y reabrir la app: el estado se conserva.
5. Cambiar a Jueves 10: aparece el recorrido de la fiesta (18 actividades), todo pendiente (independiente), con «Horario provisional» en desfiles, fuegos y encuentros. Volver al 9: lo marcado sigue marcado.
6. Cambiar a Sábado 5, Viernes 11 u otro día: solo la agenda.
7. Activar modo avión y reabrir: Calendario, el recorrido y su estado siguen disponibles.
8. Comprobar que el checklist conserva sus marcas.
9. Pendiente en dispositivos físicos (iPhone y Android): las pruebas automáticas usan Chromium con emulación móvil.

## Evidencia visual

Capturas con emulación Pixel 7 (Chromium), con las dos primeras actividades marcadas:

- Calendario 9 de diciembre: `docs/calendario-movil-2026-12-09.png` (parte superior) y `docs/calendario-movil-2026-12-09-recorrido.png` (recorrido).
- Calendario 10 de diciembre: `docs/calendario-movil-2026-12-10.png` y `docs/calendario-movil-2026-12-10-recorrido.png`.
- Inicio sin la tarjeta «Recorrido»: `docs/calendario-movil-inicio.png`.
