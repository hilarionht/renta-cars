import { expect, open, test } from './support/fixtures';
import { createBranchVehicle } from './support/reservations';

// docs/persistence/10-DECISIONES.md #155: reportar un dano leve (crea un mantenimiento
// correctivo, #137) y marcar un vehiculo fuera de servicio, desde su detalle.

test('dano leve: el vehiculo queda en mantenimiento correctivo', async ({ page, api }) => {
  const vehicle = await createBranchVehicle(api);

  await open(page, `/fleet/${vehicle.id}`);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reportar daño', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reportar daño' });
  await expect(dialog.getByLabel('Gravedad')).toHaveValue('Minor');
  await dialog.getByLabel('Detalle (opcional)').fill('Espejo lateral roto');
  await dialog.getByRole('button', { name: 'Reportar', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('En mantenimiento', { exact: true })).toBeVisible();
  const maintenance = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Mantenimientos' }) })
    .getByRole('row', { name: /Correctivo/ });
  await expect(maintenance).toContainText('Programado');
});

test('marcar un vehiculo fuera de servicio', async ({ page, api }) => {
  const vehicle = await createBranchVehicle(api);

  await open(page, `/fleet/${vehicle.id}`);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Fuera de servicio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Marcar fuera de servicio' });
  await dialog.getByLabel('Motivo (opcional)').fill('Motor fundido');
  await dialog.getByRole('button', { name: 'Marcar fuera de servicio' }).click();
  await expect(dialog).toBeHidden();

  // Fuera de servicio ya no ofrece esa accion: el unico texto es el estado.
  await expect(page.getByRole('button', { name: 'Fuera de servicio', exact: true })).toBeHidden();
  await expect(page.getByText('Fuera de servicio', { exact: true })).toBeVisible();
});
