import {
  createConfirmedReservation,
  createEligibleCustomer,
  createEnabledVehicle,
} from '../../../tooling/testing/seed/api-seed';
import { expect, open, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #148: retiro y devolucion desde la web, sobre una reserva
// confirmada sembrada por la API. El retiro no tiene ventana de fechas. La factura y el cierre
// van por evento en el mismo proceso: se espera el estado final, no los intermedios.
test('retiro y devolucion con un dano: la reserva queda cerrada y facturada', async ({
  page,
  api,
}) => {
  const vehicle = await createEnabledVehicle(api, {
    branchId: seeded('WEB_E2E_BRANCH_ID'),
    categoryId: seeded('WEB_E2E_CATEGORY_ID'),
  });
  const customer = await createEligibleCustomer(api);
  const start = new Date(Date.now() + 2 * 3_600_000);
  const reservationId = await createConfirmedReservation(api, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    startDate: start,
    endDate: new Date(start.getTime() + 2 * 86_400_000),
  });

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();

  // Retiro.
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  const checkOut = page.getByRole('dialog', { name: 'Check-out' });
  await checkOut.getByLabel('Odómetro (km)').fill('12000');
  await checkOut.getByLabel('Combustible (%)').fill('100');
  await checkOut.getByRole('button', { name: 'Registrar retiro' }).click();
  await expect(checkOut).toBeHidden();
  await expect(page.getByText('En alquiler', { exact: true })).toBeVisible();

  // Devolucion con un dano leve imputable al cliente (combustible lleno: sin cargo extra).
  await page.getByRole('button', { name: 'Check-in', exact: true }).click();
  const checkIn = page.getByRole('dialog', { name: 'Check-in' });
  await checkIn.getByLabel('Odómetro (km)').fill('12350');
  await checkIn.getByLabel('Combustible (%)').fill('100');
  await checkIn.getByRole('button', { name: 'Agregar daño' }).click();
  await checkIn.getByLabel('Descripción').fill('Rayón en puerta trasera');
  await checkIn.getByLabel('Gravedad').selectOption({ label: 'Leve' });
  await checkIn.getByLabel(/^Penalidad/).fill('1500');
  await expect(checkIn.getByRole('checkbox', { name: 'Imputable al cliente' })).toBeChecked();
  await checkIn.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(checkIn).toBeHidden();

  // La factura se emite y la reserva se cierra por evento (consulta cada 2 s).
  await expect(page.getByText('Cerrada', { exact: true })).toBeVisible({ timeout: 30_000 });
  const invoice = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /^Factura / }) });
  await expect(invoice).toBeVisible({ timeout: 30_000 });
  await expect(invoice.getByRole('row', { name: /Renta base/ })).toBeVisible();
  await expect(invoice.getByRole('row', { name: /Rayón en puerta trasera/ })).toBeVisible();
});
