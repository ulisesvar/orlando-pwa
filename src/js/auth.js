// Filtro de conveniencia, no autenticación segura: la lista es pública en el cliente.
const KEY = 'orlando-family-email-v1';
export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();
export function isAuthorized(allowed) {
  try { return allowed.includes(normalizeEmail(localStorage.getItem(KEY))); } catch { return false; }
}
export function saveAuthorization(email) {
  try { localStorage.setItem(KEY, normalizeEmail(email)); return true; } catch { return false; }
}
export function clearAuthorization() {
  try { localStorage.removeItem(KEY); } catch { /* storage disabled */ }
}
