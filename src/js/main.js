import { validateTrip } from './validate.js';
import { startRouter } from './router.js';
import { createChecklist } from './checklist.js';
import { storage } from './storage.js';
import * as v from './views.js';
import { isAuthorized, saveAuthorization, clearAuthorization, normalizeEmail } from './auth.js';

const root = document.getElementById('app');
let trip = null;
let checklist = null;
let allowedEmails = [];
let persistentAccess = true;
let currentRoute = { name: 'home' };

async function loadAccess() {
  const res = await fetch('./data/access.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.allowedEmails) || data.allowedEmails.length !== 4 || !data.allowedEmails.every((x) => typeof x === 'string'))
    throw new Error('Configuración de acceso inválida');
  return data.allowedEmails.map(normalizeEmail);
}

async function loadTrip() {
  const res = await fetch('./data/trip.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return validateTrip(await res.json());
}

let firstRender = true;
function mount(nodes, title) {
  root.replaceChildren(...nodes.flat());
  document.title = title ? `${title} · Orlando 2026` : 'Orlando 2026';
  window.scrollTo(0, 0);
  const heading = document.getElementById('page-title');
  // Mover el foco al encabezado solo en navegaciones internas (no en la carga inicial).
  if (heading && !firstRender) heading.focus({ preventScroll: true });
  firstRender = false;
}

function render(route) {
  currentRoute = route;
  if (!allowedEmails.length) return mount(v.errorView('No se pudo cargar la configuración de acceso.'), 'Error');
  if (!isAuthorized(allowedEmails))
    return mount(
      v.accessView({
        onSubmit: (email, feedback) => {
          if (!allowedEmails.includes(normalizeEmail(email))) {
            feedback.textContent = 'Este correo no está autorizado.';
            return;
          }
          persistentAccess = saveAuthorization(email);
          render(currentRoute);
        },
      }),
      'Acceso',
    );
  if (!trip) return mount(v.errorView('Los datos del viaje no son válidos o no están disponibles.'), 'Error');
  switch (route.name) {
    case 'home':
      return mount(
        [
          ...v.homeView(trip),
          ...(persistentAccess ? [] : [v.sessionOnlyNote()]),
          v.signOutView(() => {
            clearAuthorization();
            render(currentRoute);
          }),
        ],
        '',
      );
    case 'vuelos':
      return mount(v.flightsView(trip), 'Vuelos');
    case 'hotel':
      return mount(v.hotelView(trip), 'Hotel');
    case 'calendario':
      return mount(v.calendarView(trip, route.date), 'Calendario');
    case 'checklist':
      return renderChecklist();
    default:
      return mount(v.notFoundView(), 'No encontrada');
  }
}

function renderChecklist() {
  // El checkbox nativo mantiene su estado; solo se actualizan contadores (sin re-render).
  const updateCounts = () => {
    const total = checklist.progress();
    document.getElementById('progress').textContent = `${total.done} de ${total.total} completados`;
    for (const g of trip.checklist) {
      const p = checklist.progress(g);
      document.getElementById(`cnt-${g.id}`).textContent = ` ${p.done}/${p.total}`;
    }
  };
  const onToggle = (id) => {
    checklist.toggle(id);
    updateCounts();
  };
  const onReset = () => {
    checklist.reset();
    mount(v.checklistView(trip, checklist, { onToggle, onReset, persistent: storage.persistent }), 'Checklist');
    document.getElementById('reset')?.focus();
  };
  mount(v.checklistView(trip, checklist, { onToggle, onReset, persistent: storage.persistent }), 'Checklist');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // primera instalación: no recargar
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

try {
  allowedEmails = await loadAccess();
  trip = await loadTrip();
  checklist = createChecklist(trip.checklist, storage);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  trip = null;
}
startRouter(render);
registerServiceWorker();
