import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateTrip, ValidationError, isRealDate } from '../../src/js/validate.js';

const load = () => JSON.parse(readFileSync('src/data/trip.json', 'utf8'));
const bad = (mutate) => {
  const t = load();
  mutate(t);
  return () => validateTrip(t);
};

describe('validateTrip', () => {
  it('acepta el trip.json real', () => expect(() => validateTrip(load())).not.toThrow());
  it('rechaza no-objetos', () => {
    for (const v of [null, [], 'x', 5]) expect(() => validateTrip(v)).toThrow(ValidationError);
  });
  it('rechaza claves desconocidas', () =>
    expect(
      bad((t) => {
        t.extra = 1;
      }),
    ).toThrow(/no permitida/));
  it('rechaza claves faltantes', () =>
    expect(
      bad((t) => {
        delete t.hotel;
      }),
    ).toThrow(/falta "hotel"/));
  it('rechaza versión de esquema distinta', () =>
    expect(
      bad((t) => {
        t.schemaVersion = 2;
      }),
    ).toThrow(/versión/));
  it('rechaza fechas inexistentes', () =>
    expect(
      bad((t) => {
        t.days[0].date = '2026-02-30';
      }),
    ).toThrow(/fecha/));
  it('rechaza días fuera de rango o fuera de orden', () => {
    expect(
      bad((t) => {
        t.days[1].date = '2026-12-20';
      }),
    ).toThrow(/fuera/);
    expect(
      bad((t) => {
        [t.days[0], t.days[1]] = [t.days[1], t.days[0]];
      }),
    ).toThrow(/orden/);
  });
  it('rechaza horas inválidas', () =>
    expect(
      bad((t) => {
        t.flights.legs[0].departure.time = '25:00';
      }),
    ).toThrow(/hora/));
  it('rechaza ids duplicados del checklist', () =>
    expect(
      bad((t) => {
        t.checklist[1].items[0].id = t.checklist[0].items[0].id;
      }),
    ).toThrow(/duplicado/));
  it('rechaza ids con caracteres peligrosos', () =>
    expect(
      bad((t) => {
        t.checklist[0].id = '"><img src=x>';
      }),
    ).toThrow(/identificador/));
  it('rechaza textos demasiado largos o vacíos', () => {
    expect(
      bad((t) => {
        t.days[0].items[0] = 'a'.repeat(500);
      }),
    ).toThrow(/texto/);
    expect(
      bad((t) => {
        t.hotel.name = '   ';
      }),
    ).toThrow(/texto/);
  });
  it('rechaza tipos incorrectos', () =>
    expect(
      bad((t) => {
        t.days = 'x';
      }),
    ).toThrow(/lista/));
  it('reporta todos los errores', () => {
    try {
      validateTrip({});
    } catch (e) {
      expect(e.errors.length).toBeGreaterThan(5);
    }
  });
  it('isRealDate', () => {
    expect(isRealDate('2026-12-05')).toBe(true);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate(5)).toBe(false);
  });
});
