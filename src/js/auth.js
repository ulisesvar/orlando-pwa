// Filtro de conveniencia, no autenticación segura: la lista es pública en el cliente.
const KEY = 'orlando-family-email-v1';
// Respaldo en memoria si el navegador bloquea localStorage: el acceso dura solo la sesión de la página.
let memoryEmail = null;
export const normalizeEmail = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase();
function stored() {
  try {
    return localStorage.getItem(KEY) ?? memoryEmail;
  } catch {
    return memoryEmail;
  }
}
export function isAuthorized(allowed) {
  const email = normalizeEmail(stored());
  return email !== '' && allowed.includes(email);
}
// Devuelve true si la autorización quedó persistida en el dispositivo; false si solo vive en memoria.
export function saveAuthorization(email) {
  memoryEmail = normalizeEmail(email);
  try {
    localStorage.setItem(KEY, memoryEmail);
    return true;
  } catch {
    return false;
  }
}
export function clearAuthorization() {
  memoryEmail = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento deshabilitado */
  }
}
