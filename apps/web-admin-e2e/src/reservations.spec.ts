import type { Page } from '@playwright/test';

import {
  createEligibleCustomer,
  createEnabledVehicle,
  loginStaff,
} from '../../../tooling/testing/seed/api-seed';
import { expect, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #146 y #148: login por la UI (la unica cobertura del
// formulario de login), crear una reserva y confirmarla. El vehiculo y el cliente los siembra el
// propio test por la API, con un login por fetch fuera del navegador: asi la pagina arranca sin
// sesion y el login es de verdad por la UI.

// Fecha de pared (YYYY-MM-DDTHH:mm) para un input datetime-local, en la zona de la sucursal.
// Las 10:00 nunca caen en un hueco de horario de verano.
function wallClock(daysFromNow: number, time: string): string {
  return `${new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10)}T${time}`;
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  // Si Playwright escribe o hace clic antes de que React hidrate, react-hook-form pisa los
  // valores o el form hace un GET nativo: se reintenta el paso completo.
  await expect(async () => {
    await page.getByLabel('ID de compañía').fill(seeded('WEB_E2E_COMPANY_ID'));
    await page.getByLabel('Email').fill(seeded('WEB_E2E_EMAIL'));
    await page.getByLabel('Contraseña').fill(seeded('WEB_E2E_PASSWORD'));
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

test('login, crear una reserva y confirmarla', async ({ page }) => {
  const api = await loginStaff(seeded('WEB_E2E_API_URL'), {
    companyId: seeded('WEB_E2E_COMPANY_ID'),
    email: seeded('WEB_E2E_EMAIL'),
    password: seeded('WEB_E2E_PASSWORD'),
  });
  // Vehiculo y cliente nuevos por intento: un reintento no choca con el vehiculo ya ocupado.
  const { licensePlate } = await createEnabledVehicle(api, {
    branchId: seeded('WEB_E2E_BRANCH_ID'),
    categoryId: seeded('WEB_E2E_CATEGORY_ID'),
  });
  const { name: customerName } = await createEligibleCustomer(api);
  const startDay = 30;

  await login(page);

  // Navegacion por links (sin recargar la pagina ni volver a hidratar).
  await page.getByRole('link', { name: 'Reservas', exact: true }).first().click();
  await page.getByRole('link', { name: 'Nueva reserva' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva reserva' })).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Sucursal' })
    .selectOption({ label: seeded('WEB_E2E_BRANCH_NAME') });

  await page.getByLabel('Buscar por nombre, documento, email o teléfono').fill(customerName);
  await page
    .getByRole('list', { name: 'Resultados' })
    .getByRole('button', { name: new RegExp(customerName) })
    .click();
  await expect(page.getByRole('button', { name: 'Cambiar' })).toBeVisible();

  await page.getByLabel('Retiro', { exact: true }).fill(wallClock(startDay, '10:00'));
  await page.getByLabel('Devolución', { exact: true }).fill(wallClock(startDay + 2, '10:00'));

  const vehicle = page
    .getByRole('list', { name: 'Vehículos disponibles' })
    .getByRole('button', { name: new RegExp(licensePlate) });
  await vehicle.click();
  await expect(vehicle).toHaveAttribute('aria-pressed', 'true');

  // Por defecto la reserva se crea ya confirmada: este recorrido confirma desde el detalle.
  await page.getByRole('checkbox', { name: /Confirmar al crear/ }).uncheck();
  await page.getByRole('button', { name: 'Crear reserva' }).click();

  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Borrador', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar reserva' });
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
});
