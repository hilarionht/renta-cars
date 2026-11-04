import { randomInt } from 'node:crypto';

import type { Page } from '@playwright/test';

import { uniquePhone } from '../../../tooling/testing/seed/api-seed';
import { expect, open, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #154: editar la empresa y su configuracion, y encontrar el
// cambio en Auditoria. La empresa es la MISMA para todos los recorridos (global-setup): este
// solo toca el telefono de facturacion y el recordatorio de retiro, que ningun otro lee.

function section(page: Page, title: string) {
  return page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test('datos y configuracion de la empresa, con el cambio en auditoria', async ({ page, api }) => {
  void api; // la fixture deja la sesion del usuario en el contexto
  const phone = uniquePhone();
  const reminderMinutes = String(randomInt(60, 1441));

  await open(page, '/admin/company');

  const data = section(page, 'Datos');
  await data.getByLabel('Teléfono de facturación (opcional)').fill(phone);
  await data.getByRole('button', { name: 'Guardar' }).click();
  await expect(data.getByText('Guardado.')).toBeVisible();

  const reminder = section(page, 'Recordatorio de retiro');
  await reminder.getByLabel('Minutos').fill(reminderMinutes);
  await reminder.getByRole('button', { name: 'Guardar' }).click();
  await expect(reminder.getByText('Guardado.')).toBeVisible();

  await page.reload();
  await expect(section(page, 'Datos').getByLabel('Teléfono de facturación (opcional)')).toHaveValue(
    phone,
  );
  await expect(section(page, 'Recordatorio de retiro').getByLabel('Minutos')).toHaveValue(
    reminderMinutes,
  );

  // La auditoria se escribe despues de responder (#153): se recarga hasta que aparezca.
  await open(page, '/admin/audit');
  await expect(async () => {
    await page.reload();
    await page.getByLabel('Sobre').selectOption('CompanySettings');
    const entry = page
      .getByRole('row')
      .filter({ hasText: 'CompanySettingsUpdated' })
      .filter({ hasText: 'reminder-lead-time' })
      .filter({ hasText: reminderMinutes });
    await expect(entry.first()).toBeAttached({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});
