import { randomInt } from 'node:crypto';

import { uniqueSuffix } from '../../../tooling/testing/seed/api-seed';
import { PNG_FILE } from './support/files';
import { dateInDays, expect, open, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #148: alta de un cliente con su documento de identidad subido
// desde el navegador (un PNG, para cubrir otro tipo que el PDF de Flota) y verificado.
test('alta de cliente: documento subido y verificado, cliente activo', async ({ page, api }) => {
  void api; // la fixture deja la sesion del usuario en el contexto
  const suffix = uniqueSuffix();
  const name = `Cliente Web ${suffix}`;
  const phoneDigits = String(randomInt(0, 100_000_000)).padStart(8, '0');

  await open(page, '/customers/new');
  await page.getByLabel('Nombre o razón social').fill(name);
  await page.getByLabel('Documento o CUIT').fill(`DOC-${suffix}`);
  await page.getByLabel('Email').fill(`cliente-web-${suffix.toLowerCase()}@example.com`);
  await page.getByLabel('Teléfono').fill(`+52 55 ${phoneDigits}`);
  // El telefono se valida antes de enviar.
  await expect(page.getByText(/^Se guarda como \+5255/)).toBeVisible();
  const register = page.getByRole('button', { name: 'Registrar cliente' });
  await expect(register).toBeEnabled();
  await register.click();

  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Documentación pendiente', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cargar documento' }).click();
  const upload = page.getByRole('dialog', { name: 'Cargar documento' });
  await upload.getByLabel('Vencimiento').fill(dateInDays(365));
  await upload.getByLabel('Archivo').setInputFiles(PNG_FILE);
  await upload.getByRole('button', { name: 'Cargar', exact: true }).click();
  await expect(upload).toBeHidden({ timeout: 20_000 });

  const document = page.getByRole('row', { name: /DNI/ });
  await expect(document).toContainText('Pendiente');
  await document.getByRole('button', { name: 'Verificar' }).click();
  await expect(document).toContainText('Verificado');

  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Para alquilar hace falta/)).toBeHidden();
});
