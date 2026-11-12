import { test as base, expect } from '@playwright/test';

// Falla cualquier prueba que produzca errores JS, errores de consola o violaciones de CSP.
export const test = base.extend({
  // Pruebas de error controlado: el navegador registra por sí mismo respuestas 500 y JSON inválido.
  expectConsoleErrors: [false, { option: true }],
  page: async ({ page, expectConsoleErrors }, use) => {
    // Autoriza el dispositivo antes de la primera navegación, igual que un usuario recurrente.
    // Los tests específicos de acceso prueban la pantalla inicial por separado.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('orlando-family-email-v1', 'ulises.vargas@gmail.com');
      } catch {
        /* almacenamiento restringido */
      }
    });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    await use(page);
    const real = problems.filter((p) => !expectConsoleErrors || p.startsWith('pageerror'));
    expect(real, 'errores JavaScript / consola').toEqual([]);
  },
});
export { expect };
