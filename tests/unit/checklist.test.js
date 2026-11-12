import { describe, it, expect, beforeEach } from 'vitest';
import { createChecklist, parseState, serializeState, STORAGE_KEY } from '../../src/js/checklist.js';

const groups = [
  {
    id: 'a',
    title: 'A',
    items: [
      { id: 'a1', text: '1' },
      { id: 'a2', text: '2' },
    ],
  },
  { id: 'b', title: 'B', items: [{ id: 'b1', text: '3' }] },
];
const fakeStore = () => {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k), m };
};

describe('checklist', () => {
  let store;
  beforeEach(() => {
    store = fakeStore();
  });

  it('persiste y restaura el estado', () => {
    const c = createChecklist(groups, store);
    expect(c.toggle('a1')).toBe(true);
    expect(JSON.parse(store.m.get(STORAGE_KEY))).toEqual({ v: 1, done: ['a1'] });
    expect(createChecklist(groups, store).isDone('a1')).toBe(true);
  });
  it('alterna y calcula progreso', () => {
    const c = createChecklist(groups, store);
    c.toggle('a1');
    c.toggle('b1');
    c.toggle('b1');
    expect(c.progress()).toEqual({ done: 1, total: 3 });
    expect(c.progress(groups[0])).toEqual({ done: 1, total: 2 });
  });
  it('ignora ids desconocidos', () => {
    const c = createChecklist(groups, store);
    expect(c.toggle('zzz')).toBe(false);
    expect(store.m.size).toBe(0);
  });
  it('restablece', () => {
    const c = createChecklist(groups, store);
    c.toggle('a1');
    c.reset();
    expect(c.progress().done).toBe(0);
    expect(store.m.has(STORAGE_KEY)).toBe(false);
  });
  it('tolera datos corruptos o de otra versión', () => {
    for (const raw of ['{no json', '{"v":2,"done":["a1"]}', '{"v":1,"done":"a1"}', 'null', '[]', ''])
      expect(parseState(raw, ['a1']).size).toBe(0);
  });
  it('descarta ids que ya no existen y valores no string', () => {
    expect([...parseState('{"v":1,"done":["a1","old",5,null]}', ['a1'])]).toEqual(['a1']);
  });
  it('la clave de almacenamiento está versionada', () => expect(STORAGE_KEY).toMatch(/:v1$/));
  it('serializa de forma determinista', () => expect(serializeState(new Set(['b', 'a']))).toBe('{"v":1,"done":["a","b"]}'));
});
