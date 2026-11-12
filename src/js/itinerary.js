// Recorrido de Magic Kingdom (itinerarios): validación de datos y seguimiento de estado por día.
import { isRealDate, ValidationError } from './validate.js';

export const STORAGE_KEY = 'orlando2026:itinerary:v1';
export const CATEGORIES = ['traslado', 'atraccion', 'personaje', 'comida', 'descanso', 'espectaculo'];
export const PRIORITIES = ['imprescindible', 'recomendada', 'opcional'];

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_RE = /^https:\/\/[a-z0-9.-]+\/[\x21-\x7e]*$/i;

export function validateItineraries(data) {
  const errors = [];
  const err = (p, m) => errors.push(`${p}: ${m}`);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const keys = (o, p, allowed) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(p, `clave no permitida "${k}"`);
    for (const k of allowed) if (!(k in o)) err(p, `falta "${k}"`);
  };
  const str = (v, p, max) => {
    if (typeof v !== 'string' || v.trim() === '' || v.length > max) err(p, `texto requerido (máx. ${max})`);
  };
  const strOrNull = (v, p, max) => {
    if (v !== null) str(v, p, max);
  };
  if (!isObj(data)) throw new ValidationError(['raíz: se esperaba un objeto']);
  keys(data, 'raíz', ['schemaVersion', 'days']);
  if (data.schemaVersion !== 1) err('schemaVersion', 'versión no soportada');
  if (!Array.isArray(data.days) || data.days.length < 1 || data.days.length > 7) err('days', 'lista de 1 a 7 días');
  else {
    const dates = new Set();
    data.days.forEach((d, i) => {
      const p = `days[${i}]`;
      if (!isObj(d)) return err(p, 'objeto requerido');
      keys(d, p, ['date', 'title', 'shortTitle', 'disclaimer', 'sources', 'activities']);
      if (!isRealDate(d.date)) err(`${p}.date`, 'fecha AAAA-MM-DD inválida');
      else if (dates.has(d.date)) err(`${p}.date`, 'fecha duplicada');
      else dates.add(d.date);
      str(d.title, `${p}.title`, 80);
      str(d.shortTitle, `${p}.shortTitle`, 40);
      str(d.disclaimer, `${p}.disclaimer`, 300);
      if (!Array.isArray(d.sources) || d.sources.length > 5) err(`${p}.sources`, 'lista de 0 a 5 fuentes');
      else
        d.sources.forEach((s, j) => {
          const sp = `${p}.sources[${j}]`;
          if (!isObj(s)) return err(sp, 'objeto requerido');
          keys(s, sp, ['label', 'url']);
          str(s.label, `${sp}.label`, 60);
          if (typeof s.url !== 'string' || !URL_RE.test(s.url) || s.url.length > 300) err(`${sp}.url`, 'URL https requerida');
        });
      if (!Array.isArray(d.activities) || d.activities.length < 1 || d.activities.length > 40)
        return err(`${p}.activities`, 'lista de 1 a 40 actividades');
      const ids = new Set();
      let prev = '';
      let sawOpenEnded = false;
      d.activities.forEach((a, k) => {
        const ap = `${p}.activities[${k}]`;
        if (!isObj(a)) return err(ap, 'objeto requerido');
        keys(a, ap, ['id', 'start', 'label', 'name', 'description', 'zone', 'category', 'priority', 'provisional', 'notes', 'alternative']);
        if (typeof a.id !== 'string' || !ID.test(a.id)) err(`${ap}.id`, 'identificador inválido');
        else if (ids.has(a.id)) err(`${ap}.id`, 'identificador duplicado');
        else ids.add(a.id);
        if (a.start === null) sawOpenEnded = true;
        else if (typeof a.start !== 'string' || !TIME.test(a.start)) err(`${ap}.start`, 'hora HH:MM o null');
        else {
          if (sawOpenEnded) err(`${ap}.start`, 'las actividades sin hora deben ir al final');
          if (a.start < prev) err(`${ap}.start`, 'fuera de orden cronológico');
          prev = a.start;
        }
        str(a.label, `${ap}.label`, 24);
        str(a.name, `${ap}.name`, 100);
        str(a.description, `${ap}.description`, 220);
        str(a.zone, `${ap}.zone`, 80);
        if (!CATEGORIES.includes(a.category)) err(`${ap}.category`, 'categoría desconocida');
        if (!PRIORITIES.includes(a.priority)) err(`${ap}.priority`, 'prioridad desconocida');
        if (typeof a.provisional !== 'boolean') err(`${ap}.provisional`, 'booleano requerido');
        strOrNull(a.notes, `${ap}.notes`, 300);
        strOrNull(a.alternative, `${ap}.alternative`, 300);
      });
    });
  }
  if (errors.length) throw new ValidationError(errors);
  return data;
}

// Estado: { v: 1, days: { [fecha]: { [idActividad]: 'done' } } }. Pendiente es la ausencia de entrada.
// Compatibilidad: valores 'skipped' guardados por la versión anterior se tratan como pendientes y se descartan al guardar.
export function parseState(raw, days) {
  const out = {};
  for (const d of days) out[d.date] = {};
  if (raw == null) return out;
  try {
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== 1 || !obj.days || typeof obj.days !== 'object') return out;
    for (const d of days) {
      const saved = obj.days[d.date];
      if (!saved || typeof saved !== 'object') continue;
      const valid = new Set(d.activities.map((a) => a.id));
      for (const [id, st] of Object.entries(saved)) if (valid.has(id) && st === 'done') out[d.date][id] = 'done';
    }
  } catch {
    /* estado corrupto: se ignora */
  }
  return out;
}

export function createItineraryTracker(days, store) {
  const state = parseState(store.get(STORAGE_KEY), days);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const save = () => store.set(STORAGE_KEY, JSON.stringify({ v: 1, days: state }));
  const isDone = (date, id) => state[date]?.[id] === 'done';
  return {
    isDone,
    set(date, id, done) {
      const day = byDate.get(date);
      if (!day || typeof done !== 'boolean' || !day.activities.some((a) => a.id === id)) return false;
      if (done) state[date][id] = 'done';
      else delete state[date][id];
      save();
      return true;
    },
    progress(date) {
      const total = byDate.get(date).activities.length;
      const done = byDate.get(date).activities.filter((a) => isDone(date, a.id)).length;
      return { total, done, pending: total - done };
    },
    // Primera actividad pendiente en orden cronológico.
    next(date) {
      return byDate.get(date).activities.find((a) => !isDone(date, a.id)) ?? null;
    },
  };
}
