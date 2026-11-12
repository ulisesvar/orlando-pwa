import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const access = JSON.parse(readFileSync('src/data/access.json', 'utf8'));

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('auth', () => {
  let auth;
  const allowed = () => access.allowedEmails.map((e) => auth.normalizeEmail(e));
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', fakeStorage());
    auth = await import('../../src/js/auth.js');
  });

  it('access.json contiene exactamente cuatro correos distintos', () => {
    expect(access.allowedEmails).toHaveLength(4);
    expect(new Set(allowed()).size).toBe(4);
  });
  it('normaliza mayúsculas y espacios exteriores', () => {
    expect(auth.normalizeEmail('  Ulises.Vargas@GMAIL.com ')).toBe('ulises.vargas@gmail.com');
    expect(auth.normalizeEmail(null)).toBe('');
  });
  it('sin autorización guardada no concede acceso', () => {
    expect(auth.isAuthorized(allowed())).toBe(false);
  });
  it('un correo autorizado persiste y se reconoce', () => {
    expect(auth.saveAuthorization(' GUSOS28@hotmail.com ')).toBe(true);
    expect(auth.isAuthorized(allowed())).toBe(true);
  });
  it('un valor no autorizado almacenado no concede acceso', () => {
    localStorage.setItem('orlando-family-email-v1', 'otro@example.com');
    expect(auth.isAuthorized(allowed())).toBe(false);
  });
  it('clearAuthorization revoca el acceso', () => {
    auth.saveAuthorization('ulises.vargas@gmail.com');
    auth.clearAuthorization();
    expect(auth.isAuthorized(allowed())).toBe(false);
  });
  it('con localStorage bloqueado el acceso vive en memoria y se informa', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
      removeItem() {
        throw new Error('denied');
      },
    });
    expect(auth.saveAuthorization('ulises.vargas@gmail.com')).toBe(false);
    expect(auth.isAuthorized(allowed())).toBe(true);
    auth.clearAuthorization();
    expect(auth.isAuthorized(allowed())).toBe(false);
  });
});
