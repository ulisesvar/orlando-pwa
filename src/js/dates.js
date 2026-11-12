// Utilidades de fecha en español, independientes de la zona horaria y de Intl.
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const parts = (iso) => iso.split('-').map(Number);
export const weekdayName = (iso) => {
  const [y, m, d] = parts(iso);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayNumber = (iso) => parts(iso)[2];
export const monthName = (iso) => MONTHS[parts(iso)[1] - 1];
export const weekdayShort = (iso) => cap(weekdayName(iso)).slice(0, 3);
export const longDate = (iso) => `${cap(weekdayName(iso))} ${dayNumber(iso)} de ${monthName(iso)} de ${parts(iso)[0]}`;
export const dayHeading = (iso) => `${cap(weekdayName(iso))} ${dayNumber(iso)}`;

export function rangeLabel(start, end) {
  const [, sm] = parts(start);
  const [ey, em, ed] = parts(end);
  const sd = dayNumber(start);
  return sm === em ? `${sd}–${ed} de ${MONTHS[em - 1]} de ${ey}` : `${sd} de ${monthName(start)} – ${ed} de ${MONTHS[em - 1]} de ${ey}`;
}

export function time12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}
