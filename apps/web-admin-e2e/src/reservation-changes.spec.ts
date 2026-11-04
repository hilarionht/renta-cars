import {
  checkOutReservation,
  createConfirmedReservation,
  createEligibleCustomer,
  createEnabledVehicle,
  type ApiClient,
} from '../../../tooling/testing/seed/api-seed';
import { expect, open, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #154: reprogramar una reserva confirmada y aprobar una
// extension de un alquiler en curso, desde el detalle. Las fechas nuevas se confirman por la API
// (no por el formato de la UI).

const DAY = 86_400_000;

// Fecha de pared (YYYY-MM-DDTHH:mm) para un input datetime-local, en la zona de la sucursal.
// Las 10:00 nunca caen en un hueco de horario de verano.
function wallClock(daysFromNow: number, time: string): string {
  return `${new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10)}T${time}`;
}

interface ReservationDates {
  startDate: string;
  endDate: string;
}

function readReservation(api: ApiClient, id: string): Promise<ReservationDates> {
  return api.call<ReservationDates>('GET', `/reservations/${id}`);
}

async function seedConfirmed(api: ApiClient, startDate: Date, days: number): Promise<string> {
  const vehicle = await createEnabledVehicle(api, {
    branchId: seeded('WEB_E2E_BRANCH_ID'),
    categoryId: seeded('WEB_E2E_CATEGORY_ID'),
  });
  const customer = await createEligibleCustomer(api);
  return createConfirmedReservation(api, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    startDate,
    endDate: new Date(startDate.getTime() + days * DAY),
  });
}

test('reprogramar una reserva confirmada', async ({ page, api }) => {
  const reservationId = await seedConfirmed(api, new Date(Date.now() + 30 * DAY), 2);
  const before = await readReservation(api, reservationId);

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reprogramar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reprogramar' });
  await dialog.getByLabel('Retiro', { exact: true }).fill(wallClock(32, '10:00'));
  await dialog.getByLabel('Devolución', { exact: true }).fill(wallClock(35, '10:00'));
  await dialog.getByRole('button', { name: 'Reprogramar', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();

  const after = await readReservation(api, reservationId);
  expect(Date.parse(after.startDate)).toBeGreaterThan(Date.parse(before.startDate) + DAY);
  // Las dos fechas son las 10:00 de pared: la duracion queda en 3 dias justos.
  expect(Date.parse(after.endDate) - Date.parse(after.startDate)).toBe(3 * DAY);
});

test('aprobar una extension de un alquiler en curso', async ({ page, api }) => {
  const reservationId = await seedConfirmed(api, new Date(Date.now() + 2 * 3_600_000), 2);
  await checkOutReservation(api, reservationId);
  const before = await readReservation(api, reservationId);

  await open(page, `/reservations/${reservationId}`);
  await expect(page.getByText('En alquiler', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Extender', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Extender alquiler' });
  // El usuario del recorrido tiene el rol System: el boton principal aprueba.
  await dialog.getByLabel('Nueva devolución').fill(wallClock(5, '10:00'));
  await dialog.getByRole('button', { name: 'Aprobar extensión' }).click();
  await expect(dialog).toBeHidden();

  const adjustments = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ajustes de precio' }) });
  await expect(adjustments.getByRole('row', { name: /Extensión/ })).toBeVisible();
  await expect(page.getByText('En alquiler', { exact: true })).toBeVisible();

  const after = await readReservation(api, reservationId);
  expect(Date.parse(after.endDate)).toBeGreaterThan(Date.parse(before.endDate) + DAY);
});
