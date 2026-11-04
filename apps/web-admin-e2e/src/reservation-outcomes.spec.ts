import { checkOutReservation } from '../../../tooling/testing/seed/api-seed';
import { expect, open, test } from './support/fixtures';
import { createBranchVehicle, DAY, readReservation, seedConfirmed } from './support/reservations';

// docs/persistence/10-DECISIONES.md #155: cancelar, marcar como no presentado y cambiar el
// vehiculo de un alquiler en curso, desde el detalle de la reserva. El resultado se confirma
// tambien por la API.

test('cancelar una reserva confirmada', async ({ page, api }) => {
  const reservationId = await seedConfirmed(api, new Date(Date.now() + 30 * DAY), 2);

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancelar reserva' });
  await dialog.getByRole('button', { name: 'Cancelar reserva' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  expect((await readReservation(api, reservationId)).status).toBe('Cancelled');
});

test('marcar como no presentado una reserva cuyo retiro ya paso', async ({ page, api }) => {
  // La web solo ofrece la accion despues de la hora de retiro (availableActions).
  const reservationId = await seedConfirmed(api, new Date(Date.now() - 3_600_000), 2);

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'No se presentó', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Marcar como no presentado' });
  await dialog.getByRole('button', { name: 'Marcar no presentado' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  expect((await readReservation(api, reservationId)).status).toBe('Cancelled');
});

test('cambiar el vehiculo de un alquiler en curso', async ({ page, api }) => {
  const reservationId = await seedConfirmed(api, new Date(Date.now() + 2 * 3_600_000), 2);
  await checkOutReservation(api, reservationId);
  const replacement = await createBranchVehicle(api);

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('En alquiler', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar vehículo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cambiar vehículo' });
  // Las opciones son todos los disponibles de la sucursal (otros recorridos agregan los suyos):
  // se elige por id, que es el value de la opcion.
  await dialog.getByLabel('Vehículo nuevo').selectOption(replacement.id);
  await dialog.getByLabel('Motivo (opcional)').fill('Falla mecánica');
  await dialog.getByRole('button', { name: 'Cambiar vehículo' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText(replacement.licensePlate).first()).toBeVisible();
  expect((await readReservation(api, reservationId)).vehicleId).toBe(replacement.id);
});
