// Validador estricto de trip.json. Sin dependencias; rechaza claves desconocidas.
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ValidationError extends Error {
  constructor(errors) {
    super(`trip.json inválido: ${errors.slice(0, 5).join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function isRealDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateTrip(data) {
  const errors = [];
  const err = (p, m) => errors.push(`${p}: ${m}`);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const keys = (o, p, allowed) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(p, `clave no permitida "${k}"`);
    for (const k of allowed) if (!(k in o)) err(p, `falta "${k}"`);
  };
  const str = (v, p, max = 200) => {
    if (typeof v !== 'string' || v.trim() === '' || v.length > max) err(p, `texto requerido (máx. ${max})`);
  };
  const strOrNull = (v, p, max) => {
    if (v !== null) str(v, p, max);
  };
  const date = (v, p) => {
    if (!isRealDate(v)) err(p, 'fecha AAAA-MM-DD inválida');
  };
  const time = (v, p) => {
    if (typeof v !== 'string' || !TIME.test(v)) err(p, 'hora HH:MM inválida');
  };
  const id = (v, p) => {
    if (typeof v !== 'string' || !ID.test(v)) err(p, 'identificador inválido');
  };
  const arr = (v, p, min, max) => {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      err(p, `lista de ${min} a ${max} elementos`);
      return false;
    }
    return true;
  };

  if (!isObj(data)) throw new ValidationError(['raíz: se esperaba un objeto']);
  keys(data, 'raíz', ['schemaVersion', 'title', 'eyebrow', 'startDate', 'endDate', 'days', 'flights', 'hotel', 'checklist']);
  if (data.schemaVersion !== 1) err('schemaVersion', 'versión no soportada');
  str(data.title, 'title', 60);
  str(data.eyebrow, 'eyebrow', 60);
  date(data.startDate, 'startDate');
  date(data.endDate, 'endDate');
  if (isRealDate(data.startDate) && isRealDate(data.endDate) && data.startDate > data.endDate) err('endDate', 'anterior a startDate');

  if (arr(data.days, 'days', 1, 31)) {
    const seen = new Set();
    data.days.forEach((d, i) => {
      const p = `days[${i}]`;
      if (!isObj(d)) return err(p, 'objeto requerido');
      keys(d, p, ['date', 'short', 'items']);
      date(d.date, `${p}.date`);
      str(d.short, `${p}.short`, 40);
      if (seen.has(d.date)) err(p, 'fecha duplicada');
      seen.add(d.date);
      if (arr(d.items, `${p}.items`, 1, 20)) d.items.forEach((t, j) => str(t, `${p}.items[${j}]`, 200));
      if (
        isRealDate(d.date) &&
        isRealDate(data.startDate) &&
        isRealDate(data.endDate) &&
        (d.date < data.startDate || d.date > data.endDate)
      )
        err(p, 'fecha fuera del rango del viaje');
      if (i > 0 && typeof d.date === 'string' && typeof data.days[i - 1]?.date === 'string' && d.date <= data.days[i - 1].date)
        err(p, 'días fuera de orden');
    });
  }

  const place = (v, p) => {
    if (v === null) return;
    if (!isObj(v)) return err(p, 'objeto o null');
    keys(v, p, ['code', 'name', 'timezone']);
    if (typeof v.code !== 'string' || !/^[A-Z]{3}$/.test(v.code)) err(`${p}.code`, 'código IATA inválido');
    str(v.name, `${p}.name`, 80);
    if (typeof v.timezone !== 'string' || !/^[A-Za-z]+\/[A-Za-z_]+$/.test(v.timezone)) err(`${p}.timezone`, 'zona horaria IANA inválida');
  };
  if (!isObj(data.flights)) err('flights', 'objeto requerido');
  else {
    keys(data.flights, 'flights', ['airline', 'note', 'legs']);
    str(data.flights.airline, 'flights.airline', 60);
    str(data.flights.note, 'flights.note', 200);
    if (arr(data.flights.legs, 'flights.legs', 1, 10))
      data.flights.legs.forEach((l, i) => {
        const p = `flights.legs[${i}]`;
        if (!isObj(l)) return err(p, 'objeto requerido');
        keys(l, p, ['id', 'label', 'number', 'date', 'departure', 'arrival']);
        id(l.id, `${p}.id`);
        str(l.label, `${p}.label`, 40);
        if (typeof l.number !== 'string' || !/^[A-Z0-9]{2}\d{1,4}$/.test(l.number)) err(`${p}.number`, 'número de vuelo inválido');
        date(l.date, `${p}.date`);
        for (const side of ['departure', 'arrival']) {
          const s = l[side];
          if (!isObj(s)) {
            err(`${p}.${side}`, 'objeto requerido');
            continue;
          }
          keys(s, `${p}.${side}`, ['time', 'place']);
          time(s.time, `${p}.${side}.time`);
          place(s.place, `${p}.${side}.place`);
        }
      });
  }

  if (!isObj(data.hotel)) err('hotel', 'objeto requerido');
  else {
    keys(data.hotel, 'hotel', ['name', 'locality', 'address', 'mapQuery', 'checkIn', 'checkOut']);
    str(data.hotel.name, 'hotel.name', 80);
    str(data.hotel.locality, 'hotel.locality', 80);
    str(data.hotel.mapQuery, 'hotel.mapQuery', 200);
    for (const k of ['address', 'checkIn', 'checkOut']) strOrNull(data.hotel[k], `hotel.${k}`, 120);
  }

  if (arr(data.checklist, 'checklist', 1, 20)) {
    const ids = new Set();
    data.checklist.forEach((c, i) => {
      const p = `checklist[${i}]`;
      if (!isObj(c)) return err(p, 'objeto requerido');
      keys(c, p, ['id', 'title', 'items']);
      id(c.id, `${p}.id`);
      str(c.title, `${p}.title`, 60);
      if (arr(c.items, `${p}.items`, 1, 50))
        c.items.forEach((it, j) => {
          const q = `${p}.items[${j}]`;
          if (!isObj(it)) return err(q, 'objeto requerido');
          keys(it, q, ['id', 'text']);
          id(it.id, `${q}.id`);
          str(it.text, `${q}.text`, 160);
          if (ids.has(it.id)) err(q, 'id duplicado');
          ids.add(it.id);
        });
    });
  }

  if (errors.length) throw new ValidationError(errors);
  return data;
}
