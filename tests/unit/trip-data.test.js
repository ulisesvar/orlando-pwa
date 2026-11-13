import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dayHeading, longDate, rangeLabel, time12, weekdayShort, weekdayName } from '../../src/js/dates.js';
import { wazeUrl, googleMapsUrl } from '../../src/js/links.js';

const trip = JSON.parse(readFileSync('src/data/trip.json', 'utf8'));

describe('itinerario', () => {
  it('son siete días consecutivos del 5 al 11 de diciembre', () => {
    expect(trip.days.map((d) => d.date)).toEqual(['05', '06', '07', '08', '09', '10', '11'].map((d) => `2026-12-${d}`));
  });
  it('los días de la semana corresponden al calendario real', () => {
    expect(trip.days.map((d) => dayHeading(d.date))).toEqual([
      'Sábado 5',
      'Domingo 6',
      'Lunes 7',
      'Martes 8',
      'Miércoles 9',
      'Jueves 10',
      'Viernes 11',
    ]);
  });
  it('actividades cortas del calendario principal', () => {
    expect(trip.days.map((d) => d.short)).toEqual([
      'Llegada / Walmart',
      'Universal',
      'Mall',
      'Libre',
      'Magic Kingdom',
      'Very Merry',
      'Regreso',
    ]);
  });
  it('los vuelos caen en el día correcto', () => {
    expect(weekdayName(trip.flights.legs[0].date)).toBe('sábado');
    expect(weekdayName(trip.flights.legs[1].date)).toBe('viernes');
  });
});

describe('fechas', () => {
  it('formatea rangos y fechas largas', () => {
    expect(rangeLabel('2026-12-05', '2026-12-11')).toBe('5–11 de diciembre de 2026');
    expect(rangeLabel('2026-11-30', '2026-12-02')).toBe('30 de noviembre – 2 de diciembre de 2026');
    expect(longDate('2026-12-05')).toBe('Sábado 5 de diciembre de 2026');
    expect(weekdayShort('2026-12-06')).toBe('Dom');
  });
  it('formatea horas en 12 h', () => {
    expect(time12('11:10')).toBe('11:10 a. m.');
    expect(time12('15:18')).toBe('3:18 p. m.');
    expect(time12('17:05')).toBe('5:05 p. m.');
    expect(time12('19:45')).toBe('7:45 p. m.');
    expect(time12('00:05')).toBe('12:05 a. m.');
    expect(time12('12:00')).toBe('12:00 p. m.');
  });
});

describe('vuelos', () => {
  it('coinciden con los datos confirmados', () => {
    const [ida, vuelta] = trip.flights.legs;
    expect([ida.number, ida.departure.time, ida.arrival.time, ida.arrival.place.code]).toEqual(['Y4780', '11:10', '15:18', 'MCO']);
    expect([vuelta.number, vuelta.departure.time, vuelta.arrival.time, vuelta.departure.place.code]).toEqual([
      'Y4781',
      '17:05',
      '19:45',
      'MCO',
    ]);
  });
  it('usa el aeropuerto MEX confirmado para ambos trayectos', () => {
    expect(trip.flights.legs[0].departure.place.code).toBe('MEX');
    expect(trip.flights.legs[1].arrival.place.code).toBe('MEX');
  });
});

describe('enlaces de mapas', () => {
  it('Waze codifica la consulta', () => {
    expect(wazeUrl('Vacation Village at Parkway, Kissimmee, FL')).toBe(
      'https://waze.com/ul?q=Vacation%20Village%20at%20Parkway%2C%20Kissimmee%2C%20FL&navigate=yes',
    );
  });
  it('Google Maps codifica la consulta', () => {
    expect(googleMapsUrl('A&B=c')).toBe('https://www.google.com/maps/dir/?api=1&destination=A%26B%3Dc&travelmode=driving');
  });
  it('los enlaces del hotel piden ruta al resort por nombre y dirección, sin coordenadas inventadas', () => {
    const dest = 'Vacation Village at Parkway, 2975 Arabian Nights Blvd, Kissimmee, FL 34747, USA';
    expect(trip.hotel.mapQuery).toBe(dest);
    const g = new URL(googleMapsUrl(trip.hotel.mapQuery));
    expect(g.pathname).toBe('/maps/dir/');
    expect(g.searchParams.get('api')).toBe('1');
    expect(g.searchParams.get('destination')).toBe(dest);
    expect(g.searchParams.get('travelmode')).toBe('driving');
    expect(g.searchParams.has('origin')).toBe(false);
    const w = new URL(wazeUrl(trip.hotel.mapQuery));
    expect(w.searchParams.get('q')).toBe(dest);
    expect(w.searchParams.get('navigate')).toBe('yes');
    expect(w.searchParams.has('ll')).toBe(false);
  });
  it('solo la compra en Walmart del 5 de diciembre lleva botón de navegación', () => {
    const withMap = trip.days.flatMap((d) => d.items.filter((i) => typeof i === 'object').map((i) => [d.date, i]));
    expect(withMap).toEqual([
      ['2026-12-05', { text: 'Compras en Walmart.', mapQuery: 'Walmart Supercenter, 3250 Vineland Rd, Kissimmee, FL 34746, USA' }],
    ]);
    expect(googleMapsUrl(withMap[0][1].mapQuery)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Walmart%20Supercenter%2C%203250%20Vineland%20Rd%2C%20Kissimmee%2C%20FL%2034746%2C%20USA&travelmode=driving',
    );
  });
  it('una consulta maliciosa no puede alterar host ni parámetros', () => {
    const u = new URL(wazeUrl('x&navigate=no#@evil.com'));
    expect(u.host).toBe('waze.com');
    expect(u.searchParams.get('navigate')).toBe('yes');
    expect(u.hash).toBe('');
  });
});
