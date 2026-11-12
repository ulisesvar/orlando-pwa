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
  await page.getByLabel('Correo electrónico').fill(' ULISES.VARGAS@GMAIL.COM '.trim());
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

test('un correo no autorizado no abre ninguna sección, ni por URL directa', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('intruso@example.com');
  await page.getByRole('button', { name: 'Entrar' }).click();
  for (const hash of ['#/checklist', '#/vuelos', '#/hotel', '#/calendario']) {
    await page.goto(`/${hash}`);
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/Y4780|Arabian|Pasaportes|Magic Kingdom/);
  }
  expect(await page.evaluate(() => localStorage.getItem('orlando-family-email-v1'))).toBeNull();
});

test('un valor ajeno ya guardado en localStorage no concede acceso', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('orlando-family-email-v1', 'intruso@example.com'));
  await page.goto('/#/checklist');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.locator('#progress')).toHaveCount(0);
});

test('cambiar usuario conserva el checklist', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('Gusos28@hotmail.com');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto('/#/checklist');
  await page.getByLabel('Pasaportes vigentes para todos los viajeros').check();
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Cambiar usuario' }).click();
  await page.getByLabel('Correo electrónico').fill('lilgarmont_14@hotmail.com');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto('/#/checklist');
  await expect(page.locator('#progress')).toHaveText(/^1 de/);
});
