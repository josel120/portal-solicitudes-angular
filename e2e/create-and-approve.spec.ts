import { Page, expect, test } from '@playwright/test';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('Demo123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
}

test('an employee creates a request and an approver approves it', async ({ page }) => {
  const title = `Monitor e2e ${Date.now()}`;

  // Employee creates an equipment request (fields depend on the type).
  await login(page, 'ana@demo.com');
  await expect(page.getByRole('link', { name: 'Aprobaciones' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Nueva solicitud' }).click();
  await page.getByLabel('Tipo de solicitud').selectOption('equipment');
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Modelo').fill('Dell U2723QE');
  await page.getByLabel('Monto').fill('950');
  await page.getByRole('button', { name: 'Crear solicitud' }).click();

  await expect(page).toHaveURL(/\/requests\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.locator('ps-status-badge')).toHaveText('Pendiente');
  const requestUrl = page.url();

  await page.getByRole('button', { name: 'Salir' }).click();

  // Approver approves it from the inbox (another remote).
  await login(page, 'carla@demo.com');
  await page.getByRole('link', { name: 'Aprobaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Bandeja de aprobación' })).toBeVisible();

  // The inbox is oldest-first; jump to the last page where the new request lives.
  await expect(page.getByText(/solicitudes pendientes$/)).toBeVisible();
  const next = page.getByRole('button', { name: 'Siguiente' });
  for (let current = 1; (await next.count()) > 0 && (await next.isEnabled()); current++) {
    await next.click();
    await expect(page.getByText(`Página ${current + 1} de`)).toBeVisible();
  }
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: /^Aprobar/ }).click();
  await expect(page.getByText(/aprobada\.$/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0);

  // The requests remote sees the new state (list cache was invalidated by the decision).
  await page.goto(`/requests?q=${encodeURIComponent(title)}`);
  await expect(page.getByRole('row').filter({ hasText: title })).toContainText('Aprobada');
  await page.goto(requestUrl);
  await expect(page.locator('ps-status-badge')).toHaveText('Aprobada');
});
