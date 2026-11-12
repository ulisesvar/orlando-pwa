import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateItineraries, createItineraryTracker, parseState, STORAGE_KEY } from '../../src/js/itinerary.js';
import { STORAGE_KEY as CHECKLIST_KEY } from '../../src/js/checklist.js';

const raw = JSON.parse(readFileSync('src/data/itineraries.json', 'utf8'));
const data = validateItineraries(structuredClone(raw));
const day = (d) => data.days.find((x) => x.date === d);
const memStore = () => {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k), m };
};

describe('datos de itinerarios', () => {
  it('son dos días con las fechas fijas del viaje', () => {
    expect(data.days.map((d) => d.date)).toEqual(['2026-12-09', '2026-12-10']);
    expect(day('2026-12-09').title).toBe('Magic Kingdom');
    expect(day('2026-12-10').title).toBe("Mickey's Very Merry Christmas Party");
  });
  it('las actividades están en orden cronológico y las abiertas van al final', () => {
    for (const d of data.days) {
      const times = d.activities.map((a) => a.start).filter(Boolean);
      expect(times).toEqual([...times].sort());
      const firstNull = d.activities.findIndex((a) => a.start === null);
      if (firstNull >= 0) expect(d.activities.slice(firstNull).every((a) => a.start === null)).toBe(true);
    }
  });
  it('9 de diciembre contiene las actividades indicadas', () => {
    const names = day('2026-12-09').activities.map((a) => a.name);
    expect(names).toHaveLength(17);
    for (const n of ['Seven Dwarfs Mine Train', "Peter Pan's Flight", 'Mickey en Town Square Theater']) expect(names).toContain(n);
    expect(day('2026-12-09').activities[0].start).toBe('07:45');
    expect(day('2026-12-09').activities.at(-1).label).toBe('Última hora');
  });
  it('10 de diciembre: desfiles, fuegos y encuentros son provisionales', () => {
    const d = day('2026-12-10');
    for (const id of ['desfile-1', 'desfile-2', 'fuegos', 'mickey-minnie', 'minnie-sideshow']) {
      expect(d.activities.find((a) => a.id === id).provisional, id).toBe(true);
    }
    expect(d.disclaimer).toMatch(/provisionales/);
  });
  it('el bloque 20:00–21:00 no se presenta como realizable por completo', () => {
    const a = day('2026-12-10').activities.find((x) => x.id === 'atracciones-noche');
    expect(a.notes).toMatch(/no caben todas/);
    expect(a.priority).not.toBe('imprescindible');
  });
  it('no promete tiempos de espera ni duraciones', () => {
    const text = JSON.stringify(data.days.map((d) => d.activities));
    expect(text).not.toMatch(/\b\d+\s*(min|minutos)\s*de\s*(espera|fila)/i);
    expect(text).not.toMatch(/sin filas|sin espera|garantiza/i);
  });
  it('rechaza claves desconocidas, categorías inválidas y desorden', () => {
    const bad = (mutate) => {
      const c = structuredClone(raw);
      mutate(c);
      return () => validateItineraries(c);
    };
    expect(bad((c) => (c.extra = 1))).toThrow();
    expect(bad((c) => (c.days[0].activities[0].category = 'x'))).toThrow();
    expect(bad((c) => (c.days[0].activities[0].start = '25:00'))).toThrow();
    expect(bad((c) => (c.days[0].activities[1].start = '07:00'))).toThrow(/orden/);
    expect(bad((c) => (c.days[0].activities[1].id = c.days[0].activities[0].id))).toThrow(/duplicado/);
    expect(bad((c) => (c.days[0].sources[0].url = 'javascript:alert(1)'))).toThrow();
    expect(bad((c) => (c.days[0].activities[0].provisional = 'sí'))).toThrow();
  });
});

describe('seguimiento de actividades (casilla única)', () => {
  let store, t;
  beforeEach(() => {
    store = memStore();
    t = createItineraryTracker(data.days, store);
  });
  it('todo empieza pendiente y la siguiente es la primera', () => {
    expect(t.progress('2026-12-09')).toEqual({ total: 17, done: 0, pending: 17 });
    expect(t.next('2026-12-09').id).toBe('ttc');
  });
  it('marcar y desmarcar actualiza progreso y siguiente', () => {
    t.set('2026-12-09', 'ttc', true);
    t.set('2026-12-09', 'ferry', true);
    expect(t.next('2026-12-09').id).toBe('entrada');
    expect(t.progress('2026-12-09')).toMatchObject({ done: 2, pending: 15 });
    t.set('2026-12-09', 'ferry', false);
    expect(t.isDone('2026-12-09', 'ferry')).toBe(false);
    expect(t.next('2026-12-09').id).toBe('ferry');
  });
  it('los dos días son independientes aunque compartan identificadores', () => {
    t.set('2026-12-09', 'ttc', true);
    expect(t.isDone('2026-12-10', 'ttc')).toBe(false);
    expect(t.progress('2026-12-10').done).toBe(0);
  });
  it('persiste y se restaura desde el almacenamiento', () => {
    t.set('2026-12-10', 'fuegos', true);
    const t2 = createItineraryTracker(data.days, store);
    expect(t2.isDone('2026-12-10', 'fuegos')).toBe(true);
    expect(t2.isDone('2026-12-09', 'fuegos')).toBe(false);
  });
  it('desmarcar elimina la entrada guardada', () => {
    t.set('2026-12-09', 'ttc', true);
    t.set('2026-12-09', 'ttc', false);
    expect(JSON.parse(store.get(STORAGE_KEY)).days['2026-12-09']).toEqual({});
  });
  it('rechaza ids, fechas y valores no booleanos', () => {
    expect(t.set('2026-12-09', 'nope', true)).toBe(false);
    expect(t.set('2026-01-01', 'ttc', true)).toBe(false);
    expect(t.set('2026-12-09', 'ttc', 'done')).toBe(false);
    expect(store.m.size).toBe(0);
  });
  it('migración: los estados "skipped" guardados pasan a pendientes y se conservan las completadas', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        days: { '2026-12-09': { ttc: 'done', ferry: 'skipped', entrada: 'skipped' }, '2026-12-10': { fuegos: 'done' } },
      }),
    );
    const t2 = createItineraryTracker(data.days, store);
    expect(t2.isDone('2026-12-09', 'ttc')).toBe(true);
    expect(t2.isDone('2026-12-09', 'ferry')).toBe(false);
    expect(t2.isDone('2026-12-10', 'fuegos')).toBe(true);
    expect(t2.next('2026-12-09').id).toBe('ferry');
    t2.set('2026-12-09', 'mine-train', true); // al guardar se descartan los skipped
    expect(JSON.parse(store.get(STORAGE_KEY)).days['2026-12-09']).toEqual({ ttc: 'done', 'mine-train': 'done' });
  });
  it('tolera estado corrupto o con ids ajenos', () => {
    for (const bad of ['{corrupto', '[]', '{"v":2}', 'null', '{"v":1,"days":5}'])
      expect(parseState(bad, data.days)['2026-12-09']).toEqual({});
    const s = parseState(JSON.stringify({ v: 1, days: { '2026-12-09': { ttc: 'done', x: 'done', ferry: 'raro' } } }), data.days);
    expect(s['2026-12-09']).toEqual({ ttc: 'done' });
  });
  it('usa una clave propia y no toca la del checklist', () => {
    store.set(CHECKLIST_KEY, '{"v":1,"done":["doc-pasaportes"]}');
    t.set('2026-12-09', 'ttc', true);
    expect(store.get(CHECKLIST_KEY)).toBe('{"v":1,"done":["doc-pasaportes"]}');
    expect(STORAGE_KEY).not.toBe(CHECKLIST_KEY);
    expect(store.m.has(STORAGE_KEY)).toBe(true);
  });
});
