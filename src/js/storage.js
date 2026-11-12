// Acceso a localStorage con control de errores y respaldo en memoria.
const memory = new Map();
export const storage = {
  persistent: true,
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      this.persistent = false;
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      this.persistent = false;
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      this.persistent = false;
    }
    memory.delete(key);
  },
};
