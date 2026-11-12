// Lógica del checklist: estado por dispositivo en localStorage con clave versionada.
export const STORAGE_KEY = 'orlando2026:checklist:v1';

export const allItemIds = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));

export function parseState(raw, validIds) {
  if (raw == null) return new Set();
  try {
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== 1 || !Array.isArray(obj.done)) return new Set();
    const valid = new Set(validIds);
    return new Set(obj.done.filter((id) => typeof id === 'string' && valid.has(id)));
  } catch {
    return new Set();
  }
}

export const serializeState = (done) => JSON.stringify({ v: 1, done: [...done].sort() });

export function createChecklist(groups, store) {
  const ids = allItemIds(groups);
  let done = parseState(store.get(STORAGE_KEY), ids);
  const save = () => store.set(STORAGE_KEY, serializeState(done));
  return {
    isDone: (id) => done.has(id),
    toggle(id) {
      if (!ids.includes(id)) return false;
      done.has(id) ? done.delete(id) : done.add(id);
      save();
      return done.has(id);
    },
    reset() {
      done = new Set();
      store.remove(STORAGE_KEY);
    },
    progress: (group) => {
      const items = group ? group.items : ids.map((id) => ({ id }));
      return { done: items.filter((i) => done.has(i.id)).length, total: items.length };
    },
  };
}
