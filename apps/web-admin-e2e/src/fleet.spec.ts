import { uniqueSuffix } from '../../../tooling/testing/seed/api-seed';
import { PDF_FILE } from './support/files';
import { dateInDays, expect, open, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #148: alta de un vehiculo con su documento subido desde el
// navegador (URL firmada, PUT directo al storage), verificacion y habilitacion.
test('alta de vehiculo: documento subido, verificado y vehiculo disponible', async ({
  page,
  api,
}) => {
  void api; // la fixture deja la sesion del usuario en el contexto
  const suffix = uniqueSuffix();
  const licensePlate = `FLT-${suffix}`;

  await open(page, '/fleet/new');
  await page
    .getByRole('combobox', { name: 'Sucursal' })
    .selectOption({ label: seeded('WEB_E2E_BRANCH_NAME') });
  await page
    .getByRole('combobox', { name: 'Categoría' })
    .selectOption({ label: seeded('WEB_E2E_CATEGORY_NAME') });
  await page.getByLabel('Patente').fill(licensePlate);
  await page.getByLabel('VIN', { exact: true }).fill(`1HGCM82633A${suffix}`);
  const register = page.getByRole('button', { name: 'Registrar vehículo' });
  await expect(register).toBeEnabled();
  await register.click();

  await expect(page).toHaveURL(/\/fleet\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Registrado', { exact: true })).toBeVisible();

  // Documento: la subida va directo al storage (CSP connect-src y CORS del bucket).
  await page.getByRole('button', { name: 'Cargar documento' }).click();
  const upload = page.getByRole('dialog', { name: 'Cargar documento' });
  await upload.getByLabel('Vencimiento').fill(dateInDays(365));
  await upload.getByLabel('Archivo').setInputFiles(PDF_FILE);
  await upload.getByRole('button', { name: 'Cargar', exact: true }).click();
  await expect(upload).toBeHidden({ timeout: 20_000 });

  const document = page.getByRole('row', { name: /Tarjeta de propiedad/ });
  await expect(document).toContainText('Pendiente');
  await document.getByRole('button', { name: 'Verificar' }).click();
  await expect(document).toContainText('Verificado');

  await page.getByRole('button', { name: 'Habilitar', exact: true }).first().click();
  const enable = page.getByRole('dialog', { name: 'Habilitar vehículo' });
  await enable.getByRole('button', { name: 'Habilitar' }).click();
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
});
