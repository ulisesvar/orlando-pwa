import { describe, it, expect } from 'vitest';
import { createUpdater, MIN_CHECK_INTERVAL_MS } from '../../src/js/updater.js';

// Doble mínimo de EventTarget con registro de oyentes.
function target() {
  const l = {};
  return {
    addEventListener: (t, f) => (l[t] ??= []).push(f),
    emit: (t) => (l[t] ?? []).forEach((f) => f()),
  };
}

function setup({ controller = {}, waiting = null, online = true, minInterval } = {}) {
  const sw = Object.assign(target(), { controller });
  const doc = Object.assign(target(), { visibilityState: 'visible' });
  const posted = [];
  const reg = Object.assign(target(), {
    waiting,
    installing: null,
    updates: 0,
    update() {
      this.updates++;
      return Promise.resolve();
    },
  });
  if (waiting) waiting.postMessage = (m) => posted.push(m);
  const state = { clock: 1_000_000, online, offers: [], reloads: 0 };
  const updater = createUpdater({
    sw,
    doc,
    isOnline: () => state.online,
    now: () => state.clock,
    minInterval,
    onReady: (o) => state.offers.push(o),
    reload: () => state.reloads++,
  });
  return { sw, doc, reg, posted, state, updater, start: () => updater.start(async () => reg) };
}

const newWorker = () => Object.assign(target(), { state: 'installing', postMessage() {} });

describe('actualizador de la PWA', () => {
  it('no ofrece nada en la primera instalación (sin controlador previo)', async () => {
    const t = setup({ controller: null, waiting: { postMessage() {} } });
    await t.start();
    expect(t.state.offers).toHaveLength(0);
    t.sw.emit('controllerchange');
    expect(t.state.reloads).toBe(0);
  });

  it('ofrece una versión que ya estaba en espera al abrir la app', async () => {
    const t = setup({ waiting: { postMessage() {} } });
    await t.start();
    expect(t.state.offers).toHaveLength(1);
  });

  it('ofrece cuando una versión nueva termina de instalarse, una sola vez', async () => {
    const t = setup();
    await t.start();
    expect(t.state.offers).toHaveLength(0);
    const w = newWorker();
    t.reg.installing = w;
    t.reg.emit('updatefound');
    w.state = 'installing';
    w.emit('statechange');
    expect(t.state.offers).toHaveLength(0); // aún no está lista
    w.state = 'installed';
    w.emit('statechange');
    w.emit('statechange'); // eventos repetidos no duplican el aviso
    t.reg.emit('updatefound');
    expect(t.state.offers).toHaveLength(1);
  });

  it('no activa (skipWaiting) hasta que la persona confirma', async () => {
    const t = setup({ waiting: {} });
    t.reg.waiting.postMessage = (m) => t.posted.push(m);
    await t.start();
    expect(t.posted).toEqual([]);
    t.state.offers[0].update();
    expect(t.posted).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('«Más tarde» no vuelve a avisar en esta apertura, aunque se compruebe de nuevo', async () => {
    const t = setup({ waiting: { postMessage() {} }, minInterval: 0 });
    await t.start();
    t.state.offers[0].later();
    t.updater.check();
    t.reg.emit('updatefound');
    const w = newWorker();
    t.reg.installing = w;
    t.reg.emit('updatefound');
    w.state = 'installed';
    w.emit('statechange');
    expect(t.state.offers).toHaveLength(1);
  });

  it('en una apertura posterior (instancia nueva) se vuelve a ofrecer', async () => {
    const first = setup({ waiting: { postMessage() {} } });
    await first.start();
    first.state.offers[0].later();
    const second = setup({ waiting: { postMessage() {} } });
    await second.start();
    expect(second.state.offers).toHaveLength(1);
  });

  it('recarga una sola vez al cambiar el controlador', async () => {
    const t = setup({ waiting: { postMessage() {} } });
    await t.start();
    t.sw.emit('controllerchange');
    t.sw.emit('controllerchange');
    t.sw.emit('controllerchange');
    expect(t.state.reloads).toBe(1);
  });

  it('comprueba al iniciar y limita la frecuencia al volver a primer plano', async () => {
    const t = setup();
    await t.start();
    expect(t.reg.updates).toBe(1); // al iniciar
    t.doc.emit('visibilitychange');
    t.doc.emit('visibilitychange');
    expect(t.reg.updates).toBe(1); // dentro del intervalo
    t.state.clock += MIN_CHECK_INTERVAL_MS - 1;
    t.doc.emit('visibilitychange');
    expect(t.reg.updates).toBe(1);
    t.state.clock += 2;
    t.doc.emit('visibilitychange');
    expect(t.reg.updates).toBe(2);
  });

  it('no comprueba si la página está oculta ni sin conexión', async () => {
    const t = setup({ minInterval: 0 });
    await t.start();
    const base = t.reg.updates;
    t.doc.visibilityState = 'hidden';
    t.doc.emit('visibilitychange');
    expect(t.reg.updates).toBe(base);
    t.doc.visibilityState = 'visible';
    t.state.online = false;
    t.doc.emit('visibilitychange');
    expect(t.updater.check({ force: true })).toBe(false);
    expect(t.reg.updates).toBe(base);
  });

  it('un fallo de update() no rompe la app', async () => {
    const t = setup({ minInterval: 0 });
    t.reg.update = () => Promise.reject(new Error('red'));
    await expect(t.start()).resolves.toBeUndefined();
  });

  it('si el registro falla, start no lanza', async () => {
    const t = setup();
    await expect(t.updater.start(async () => Promise.reject(new Error('x')))).resolves.toBeUndefined();
  });

  it('apply sin versión en espera no hace nada', async () => {
    const t = setup();
    await t.start();
    expect(t.updater.apply()).toBe(false);
  });
});
