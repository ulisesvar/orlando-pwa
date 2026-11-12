import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('solicita correo en la primera visita y rechaza uno no autorizado', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
  await expect(page.locator('a.card')).toHaveCount(0);
  await page.getByLabel('Correo electrónico').fill('desconocido@example.com');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('no está autorizado');
  await expect(page.locator('a.card')).toHaveCount(0);
});

test('recuerda el correo autorizado tras recargar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(' ULISES.VARGAS@GMAIL.COM ' .trim());
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('a.card')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('a.card')).toHaveCount(4);
  await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
});

test('cambiar usuario elimina autorización del dispositivo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('ulises.vargas@gmail.com');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Cambiar usuario' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});
