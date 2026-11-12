import { h, icon } from './dom.js';
import { routeHref } from './router.js';
import { wazeUrl, googleMapsUrl } from './links.js';
import { cap, dayNumber, longDate, rangeLabel, time12, weekdayShort, weekdayName } from './dates.js';

const extLink = (href, cls, label) =>
  h(
    'a',
    { href, class: cls, target: '_blank', rel: 'noopener noreferrer' },
    label,
    icon('external', 'icon icon-sm'),
    h('span', { class: 'sr-only' }, ' (se abre en una pestaña nueva)'),
  );

const page = (title, ...content) => [
  h(
    'header',
    { class: 'page-head' },
    h('a', { href: routeHref('home'), class: 'back', 'aria-label': 'Volver al inicio' }, icon('back'), h('span', {}, 'Inicio')),
    h('h1', { id: 'page-title', tabindex: '-1' }, title),
  ),
  ...content,
];

export function homeView(trip) {
  const cards = [
    ['vuelos', 'plane', 'Vuelos', 'Horarios y detalles'],
    ['hotel', 'hotel', 'Hotel', 'Ubicación y Waze'],
    ['calendario', 'calendar', 'Calendario', 'Actividades por día'],
    ['itinerarios', 'navigate', 'Recorrido', 'Magic Kingdom: 9 y 10 de diciembre'],
    ['checklist', 'checklist', 'Checklist', 'Lista de pendientes'],
  ];
  return [
    h(
      'header',
      { class: 'hero' },
      h('p', { class: 'eyebrow' }, trip.eyebrow),
      h('h1', { id: 'page-title', tabindex: '-1' }, trip.title),
      h('p', { class: 'dates' }, rangeLabel(trip.startDate, trip.endDate)),
    ),
    h(
      'section',
      { 'aria-labelledby': 'week-h' },
      h('h2', { id: 'week-h', class: 'sr-only' }, 'Resumen de la semana'),
      h(
        'ol',
        { class: 'week' },
        trip.days.map((d) =>
          h(
            'li',
            { class: 'week-day' },
            h('span', { class: 'wd' }, weekdayShort(d.date)),
            h('span', { class: 'wn' }, String(dayNumber(d.date))),
            h('span', { class: 'wa' }, d.short),
          ),
        ),
      ),
    ),
    h(
      'nav',
      { 'aria-label': 'Secciones' },
      h(
        'ul',
        { class: 'cards' },
        cards.map(([r, ic, t, s]) =>
          h(
            'li',
            {},
            h(
              'a',
              { href: routeHref(r), class: 'card' },
              h('span', { class: 'card-icon' }, icon(ic)),
              h('span', { class: 'card-text' }, h('span', { class: 'card-title' }, t), h('span', { class: 'card-sub' }, s)),
              icon('chevron', 'icon card-chev'),
            ),
          ),
        ),
      ),
    ),
  ];
}

const placeText = (p) => (p ? `${p.name} (${p.code})` : 'Aeropuerto no especificado');

export function flightsView(trip) {
  const f = trip.flights;
  return page(
    'Vuelos',
    h('p', { class: 'lead' }, f.airline),
    f.legs.map((l) =>
      h(
        'article',
        { class: 'panel', 'aria-labelledby': `fl-${l.id}` },
        h('h2', { id: `fl-${l.id}` }, l.label),
        h('p', { class: 'meta' }, `${l.number} · ${longDate(l.date)}`),
        h(
          'dl',
          { class: 'times' },
          ...['departure', 'arrival'].flatMap((side) => [
            h('dt', {}, side === 'departure' ? 'Salida' : 'Llegada'),
            h(
              'dd',
              {},
              h('span', { class: 'big' }, time12(l[side].time)),
              h('span', { class: 'sub' }, placeText(l[side].place)),
              h('span', { class: 'sub' }, l[side].place ? `Hora local (${l[side].place.timezone})` : 'Hora local del aeropuerto'),
            ),
          ]),
        ),
      ),
    ),
    h('p', { class: 'note' }, f.note),
  );
}

export function hotelView(trip) {
  const ht = trip.hotel;
  return page(
    'Hotel',
    h(
      'article',
      { class: 'panel' },
      h('div', { class: 'hotel-head' }, icon('pin'), h('div', {}, h('h2', {}, ht.name), h('p', { class: 'meta' }, ht.locality))),
      h(
        'dl',
        { class: 'facts' },
        h('dt', {}, 'Dirección'),
        h('dd', {}, ht.address ?? 'Por confirmar con el hotel'),
        ...(ht.checkIn ? [h('dt', {}, 'Check-in'), h('dd', {}, ht.checkIn)] : []),
        ...(ht.checkOut ? [h('dt', {}, 'Checkout'), h('dd', {}, ht.checkOut)] : []),
      ),
    ),
    h(
      'div',
      { class: 'actions' },
      extLink(wazeUrl(ht.mapQuery), 'btn btn-primary', 'Ir con Waze'),
      extLink(googleMapsUrl(ht.mapQuery), 'btn btn-secondary', 'Abrir en Google Maps'),
    ),
    h('p', { class: 'note' }, 'Los enlaces buscan el hotel por su dirección.'),
  );
}

export function calendarView(trip, selected) {
  const sel = trip.days.find((d) => d.date === selected) ?? null;
  const current = sel ?? trip.days[0];
  return page(
    'Calendario',
    h(
      'nav',
      { 'aria-label': 'Días del viaje' },
      h(
        'ul',
        { class: 'daytabs' },
        trip.days.map((d) =>
          h(
            'li',
            {},
            h(
              'a',
              {
                href: routeHref('calendario', d.date),
                class: 'daytab',
                'aria-current': d.date === current.date ? 'page' : false,
              },
              h('span', { class: 'wd', 'aria-hidden': 'true' }, weekdayShort(d.date)),
              h('span', { class: 'sr-only' }, `${cap(weekdayName(d.date))} `),
              h('span', { class: 'wn' }, String(dayNumber(d.date))),
            ),
          ),
        ),
      ),
    ),
    h(
      'article',
      { class: 'panel', 'aria-labelledby': 'day-h' },
      h('h2', { id: 'day-h' }, longDate(current.date)),
      h('p', { class: 'meta' }, current.short),
      h(
        'ul',
        { class: 'agenda' },
        current.items.map((t) => h('li', {}, t)),
      ),
    ),
    h('p', { class: 'note' }, 'No hay horarios definidos para las actividades; se agregarán cuando estén confirmados.'),
  );
}

export function checklistView(trip, checklist, { onToggle, onReset, persistent }) {
  const total = checklist.progress();
  const groups = trip.checklist.map((g) => {
    const p = checklist.progress(g);
    return h(
      'section',
      { class: 'panel', 'aria-labelledby': `cg-${g.id}` },
      h('h2', { id: `cg-${g.id}` }, g.title, h('span', { class: 'count', id: `cnt-${g.id}` }, ` ${p.done}/${p.total}`)),
      h(
        'ul',
        { class: 'checks' },
        g.items.map((it) => {
          const cid = `ck-${it.id}`;
          return h(
            'li',
            {},
            h('input', { type: 'checkbox', id: cid, checked: checklist.isDone(it.id), onchange: () => onToggle(it.id) }),
            h('label', { for: cid }, h('span', { class: 'box' }, icon('check')), h('span', { class: 'ck-text' }, it.text)),
          );
        }),
      ),
    );
  });
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': 'dlg-h' },
    h('h2', { id: 'dlg-h' }, '¿Restablecer el checklist?'),
    h('p', {}, 'Se desmarcarán todos los elementos de este dispositivo. Esta acción no se puede deshacer.'),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => dialog.close() }, 'Cancelar'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-danger',
          id: 'confirm-reset',
          onclick: () => {
            dialog.close();
            onReset();
          },
        },
        'Sí, restablecer',
      ),
    ),
  );
  return page(
    'Checklist',
    h('p', { class: 'lead', role: 'status', id: 'progress' }, `${total.done} de ${total.total} completados`),
    persistent
      ? null
      : h('p', { class: 'note warn', role: 'alert' }, 'Este navegador no permite guardar datos; el avance se perderá al cerrar la app.'),
    groups,
    h('button', { type: 'button', class: 'btn btn-secondary', id: 'reset', onclick: () => dialog.showModal() }, 'Restablecer checklist'),
    dialog,
  );
}

export const errorView = (message) => page('No se pudo cargar', h('p', { class: 'panel', role: 'alert' }, message));
export const notFoundView = () =>
  page(
    'Página no encontrada',
    h('p', { class: 'panel' }, 'La sección solicitada no existe.'),
    h('a', { href: routeHref('home'), class: 'btn btn-primary' }, 'Ir al inicio'),
  );
export { cap, weekdayName };

export function accessView({ onSubmit }) {
  const input = h('input', {
    id: 'family-email',
    type: 'email',
    required: true,
    autocomplete: 'email',
    inputmode: 'email',
    placeholder: 'nombre@correo.com',
    class: 'field',
  });
  const feedback = h('p', { role: 'alert', 'aria-live': 'polite' });
  return [
    h(
      'header',
      { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'NUESTRO VIAJE'),
      h('h1', { id: 'page-title', tabindex: '-1' }, 'Orlando 2026'),
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Bienvenido'),
      h('p', {}, 'Escribe tu correo autorizado. Solo tendrás que hacerlo una vez en este dispositivo.'),
      h(
        'form',
        {
          onsubmit: (event) => {
            event.preventDefault();
            onSubmit(input.value, feedback);
          },
        },
        h('label', { for: 'family-email' }, 'Correo electrónico'),
        input,
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Entrar'),
        feedback,
      ),
    ),
  ];
}

export function signOutView(onSignOut) {
  return h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: onSignOut }, 'Cambiar usuario'));
}

export function sessionOnlyNote() {
  return h(
    'p',
    { class: 'note', role: 'status' },
    'Este navegador no permite guardar el acceso: tendrás que escribir tu correo de nuevo al cerrar la aplicación.',
  );
}

const CATEGORY_LABEL = {
  traslado: 'Traslado',
  atraccion: 'Atracción',
  personaje: 'Personaje',
  comida: 'Comida',
  descanso: 'Descanso',
  espectaculo: 'Espectáculo',
};

const progressText = (p) => `Realizadas: ${p.done} de ${p.total}`;

export function itinerariesIndexView(days, tracker) {
  return page(
    'Recorrido',
    h(
      'p',
      { class: 'lead' },
      'Elige el día. Marca cada actividad al terminarla; el avance se guarda en este dispositivo y funciona sin conexión.',
    ),
    h(
      'ul',
      { class: 'cards' },
      days.map((d) =>
        h(
          'li',
          {},
          h(
            'a',
            { href: routeHref('itinerarios', d.date), class: 'card' },
            h(
              'span',
              { class: 'card-text' },
              h('span', { class: 'card-title' }, d.title),
              h('span', { class: 'card-sub' }, `${cap(longDate(d.date))} · ${progressText(tracker.progress(d.date))}`),
            ),
            icon('chevron', 'icon card-chev'),
          ),
        ),
      ),
    ),
  );
}

export function itineraryDayView(days, date, tracker) {
  const day = days.find((d) => d.date === date);
  const summary = h('section', { class: 'panel it-summary', 'aria-label': 'Progreso del día', id: 'it-summary' });
  const items = new Map();

  const refresh = () => {
    const p = tracker.progress(date);
    const next = tracker.next(date);
    summary.replaceChildren(
      h('p', { class: 'it-progress', role: 'status', id: 'it-progress' }, progressText(p)),
      h('progress', { class: 'it-bar', max: p.total, value: p.done, 'aria-label': 'Actividades realizadas' }),
      next
        ? h('p', { class: 'it-next' }, h('strong', {}, 'Siguiente: '), `${next.label} · ${next.name}`)
        : h('p', { class: 'it-next' }, h('strong', {}, '¡Recorrido completo! '), 'No quedan actividades pendientes.'),
    );
    for (const a of day.activities) {
      const { li, flag } = items.get(a.id);
      const isNext = !!next && next.id === a.id;
      li.className = `it-item${tracker.isDone(date, a.id) ? ' st-done' : ''}${isNext ? ' is-next' : ''}`;
      flag.hidden = !isNext;
    }
  };

  const activity = (a) => {
    const cid = `it-${a.id}`;
    const flag = h('span', { class: 'tag tag-next', hidden: true }, 'Siguiente');
    const li = h(
      'li',
      { class: 'it-item' },
      h('input', {
        type: 'checkbox',
        id: cid,
        class: 'it-check',
        checked: tracker.isDone(date, a.id),
        onchange: (e) => {
          tracker.set(date, a.id, e.target.checked);
          refresh();
        },
      }),
      h(
        'label',
        { for: cid, class: 'it-row' },
        h('span', { class: 'it-box' }, icon('check')),
        h('span', { class: 'it-time' }, a.label),
        h('span', { class: 'it-name' }, a.name),
      ),
      h(
        'div',
        { class: 'it-body' },
        h(
          'p',
          { class: 'it-tags' },
          flag,
          h('span', { class: `tag prio-${a.priority}` }, a.priority.charAt(0).toUpperCase() + a.priority.slice(1)),
          h('span', { class: 'tag' }, CATEGORY_LABEL[a.category]),
          a.provisional ? h('span', { class: 'tag tag-prov' }, 'Horario provisional') : null,
        ),
        h('p', {}, a.description),
        h('p', { class: 'meta' }, `Zona: ${a.zone}`),
        a.notes ? h('p', { class: 'it-note' }, h('strong', {}, 'Observación: '), a.notes) : null,
        a.alternative ? h('p', { class: 'it-note' }, h('strong', {}, 'Alternativa: '), a.alternative) : null,
      ),
    );
    items.set(a.id, { li, flag });
    return li;
  };

  const list = h('ol', { class: 'it-list' }, day.activities.map(activity));
  refresh();
  return page(
    day.title,
    h(
      'nav',
      { 'aria-label': 'Días del recorrido' },
      h(
        'ul',
        { class: 'it-tabs' },
        days.map((d) =>
          h(
            'li',
            {},
            h(
              'a',
              { href: routeHref('itinerarios', d.date), class: 'daytab it-tab', 'aria-current': d.date === date ? 'page' : false },
              d.shortTitle,
            ),
          ),
        ),
      ),
    ),
    h('p', { class: 'lead' }, cap(longDate(date))),
    h('p', { class: 'note warn-prov', id: 'it-disclaimer' }, day.disclaimer),
    summary,
    list,
    day.sources.length
      ? h(
          'p',
          { class: 'note' },
          'Fuentes oficiales para verificar: ',
          day.sources.flatMap((s, i) => [i ? ' · ' : '', extLink(s.url, 'inline-link', s.label)]),
        )
      : null,
  );
}
