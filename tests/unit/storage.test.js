import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('storage', () => {
  it('usa respaldo en memoria si localStorage lanza errores', async () => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.stubGlobal('window', { localStorage: { getItem: boom, setItem: boom, removeItem: boom } });
    const { storage } = await import('../../src/js/storage.js');
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
    expect(storage.persistent).toBe(false);
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
  });
  it('lee y escribe en localStorage cuando funciona', async () => {
    const m = new Map();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) },
    });
    const { storage } = await import('../../src/js/storage.js');
    storage.set('k', 'v');
    expect(m.get('k')).toBe('v');
    expect(storage.persistent).toBe(true);
  });
});
