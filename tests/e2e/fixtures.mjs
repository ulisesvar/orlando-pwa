import { test as base, expect } from '@playwright/test';

// Falla cualquier prueba que produzca errores JS, errores de consola o violaciones de CSP.
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    await use(page);
    expect(problems, 'errores JavaScript / consola').toEqual([]);
  },
});
export { expect };
