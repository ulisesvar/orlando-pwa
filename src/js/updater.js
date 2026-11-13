// Actualización de la PWA con confirmación. Ciclo: install → waiting → (confirmación) → activate → controllerchange.
// La lógica recibe sus dependencias por parámetro para poder probarla sin navegador.
export const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function createUpdater({ sw, doc, isOnline = () => true, now = Date.now, minInterval = MIN_CHECK_INTERVAL_MS, onReady, reload }) {
  const hadController = !!sw.controller; // sin controlador previo es la primera instalación: no hay nada que ofrecer
  let reg = null;
  let lastCheck = -Infinity;
  let offered = false; // un solo aviso a la vez
  let dismissed = false; // «Más tarde»: no insistir durante esta apertura; se vuelve a ofrecer en la siguiente
  let reloaded = false; // una sola recarga por página

  function offer() {
    if (!hadController || offered || dismissed) return;
    offered = true;
    onReady({
      update: apply,
      later() {
        dismissed = true;
        offered = false;
      },
    });
  }

  function apply() {
    const waiting = reg?.waiting;
    if (!waiting) return false; // la espera ya terminó o no hay versión nueva
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }

  function watch(registration) {
    reg = registration;
    if (reg.waiting) offer();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') offer();
      });
    });
  }

  // Comprobación con límite de frecuencia y solo con conexión.
  function check({ force = false } = {}) {
    if (!reg || !isOnline()) return false;
    const t = now();
    if (!force && t - lastCheck < minInterval) return false;
    lastCheck = t;
    Promise.resolve(reg.update()).catch(() => {});
    return true;
  }

  // Cuando la versión nueva toma el control (en esta u otra pestaña) se recarga una sola vez
  // para que HTML, JS y datos de la página sean los de la misma versión.
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    reload();
  });

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') check();
  });

  return {
    async start(register) {
      try {
        watch(await register());
        check();
      } catch {
        /* sin Service Worker: la app sigue funcionando en línea */
      }
    },
    check,
    apply,
  };
}
