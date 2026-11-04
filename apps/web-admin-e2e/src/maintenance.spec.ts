import { createEnabledVehicle } from '../../../tooling/testing/seed/api-seed';
import { dateInDays, expect, open, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #154: programar, iniciar y completar un mantenimiento desde
// el detalle del vehiculo. Al completarlo como apto, el vehiculo vuelve a estar disponible.
test('mantenimiento preventivo: programado, en curso y completado apto', async ({ page, api }) => {
  const vehicle = await createEnabledVehicle(api, {
    branchId: seeded('WEB_E2E_BRANCH_ID'),
    categoryId: seeded('WEB_E2E_CATEGORY_ID'),
  });

  await open(page, `/fleet/${vehicle.id}`);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Programar mantenimiento', exact: true }).click();
  const schedule = page.getByRole('dialog', { name: 'Programar mantenimiento' });
  await expect(schedule.getByLabel('Tipo')).toHaveValue('Preventive');
  await schedule.getByLabel('Inicio').fill(`${dateInDays(1)}T09:00`);
  await schedule.getByLabel('Fin').fill(`${dateInDays(1)}T17:00`);
  await schedule.getByRole('button', { name: 'Programar', exact: true }).click();
  await expect(schedule).toBeHidden();
  await expect(page.getByText('En mantenimiento', { exact: true })).toBeVisible();

  const maintenance = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Mantenimientos' }) })
    .getByRole('row', { name: /Preventivo/ });
  await expect(maintenance).toContainText('Programado');

  await maintenance.getByRole('button', { name: 'Iniciar' }).click();
  await expect(maintenance).toContainText('En curso');

  await maintenance.getByRole('button', { name: 'Completar' }).click();
  const complete = page.getByRole('dialog', { name: 'Completar mantenimiento' });
  await expect(complete.getByLabel('Resultado de la verificación')).toHaveValue('true');
  await complete.getByRole('button', { name: 'Completar', exact: true }).click();
  await expect(complete).toBeHidden();

  await expect(maintenance).toContainText('Completado (apto)');
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
});
