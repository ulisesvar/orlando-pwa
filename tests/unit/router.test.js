import { describe, it, expect } from 'vitest';
import { parseRoute, routeHref } from '../../src/js/router.js';

describe('router', () => {
  it('rutas válidas', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    for (const n of ['vuelos', 'hotel', 'checklist', 'calendario']) expect(parseRoute(`#/${n}`)).toEqual({ name: n });
    expect(parseRoute('#/calendario/2026-12-07')).toEqual({ name: 'calendario', date: '2026-12-07' });
    expect(parseRoute('#/hotel/')).toEqual({ name: 'hotel' });
    expect(parseRoute('#/itinerarios')).toEqual({ name: 'itinerarios' });
    expect(parseRoute('#/itinerarios/2026-12-09')).toEqual({ name: 'itinerarios', date: '2026-12-09' });
  });
  it('rutas inválidas o manipuladas', () => {
    for (const h of [
      '#/nada',
      '#/calendario/2026-13-40',
      '#/calendario/<script>',
      '#/hotel/x',
      '#/a/b/c',
      '#/itinerarios/2026-02-31',
      '#/itinerarios/x/y',
      '#/../etc/passwd',
    ])
      expect(parseRoute(h)).toEqual({ name: 'notfound' });
  });
  it('genera hrefs', () => {
    expect(routeHref('home')).toBe('#/');
    expect(routeHref('calendario', '2026-12-05')).toBe('#/calendario/2026-12-05');
    expect(routeHref('vuelos')).toBe('#/vuelos');
  });
});
