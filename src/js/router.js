// Enrutador por hash: funciona sin servidor, con botón Atrás, enlaces y recarga.
import { isRealDate } from './validate.js';

export function parseRoute(hash) {
  const path = (hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
  const [name, arg, extra] = path.split('/');
  if (extra !== undefined) return { name: 'notfound' };
  if (!name) return { name: 'home' };
  if (name === 'vuelos' || name === 'hotel' || name === 'checklist') return arg === undefined ? { name } : { name: 'notfound' };
  if (name === 'calendario') {
    if (arg === undefined) return { name };
    return isRealDate(arg) ? { name, date: arg } : { name: 'notfound' };
  }
  return { name: 'notfound' };
}

export const routeHref = (name, arg) => `#/${[name === 'home' ? '' : name, arg].filter(Boolean).join('/')}`;

export function startRouter(onRoute) {
  const run = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', run);
  run();
}
