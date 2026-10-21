import { createCustomRole, uniqueSuffix } from '../../../tooling/testing/seed/api-seed';
import { expect, open, seeded, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #148: alta de un usuario con un rol y una sucursal desde
// Administracion. El rol se siembra propio por la API: el selector tambien lista los roles
// System de cualquier company, y en local hay muchos de pruebas anteriores.
test('alta de usuario con rol y sucursal: aparece activo en el listado', async ({ page, api }) => {
  const suffix = uniqueSuffix();
  const roleName = `Mostrador ${suffix}`;
  await createCustomRole(api, roleName, ['reservations:check-out', 'reservations:check-in']);
  const name = `Operador ${suffix}`;
  const email = `operador-${suffix.toLowerCase()}@example.com`;
  const branchName = seeded('WEB_E2E_BRANCH_NAME');

  await open(page, '/admin/users');
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const create = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await create.getByLabel('Nombre', { exact: true }).fill(name);
  await create.getByLabel('Email').fill(email);
  await create.getByLabel('Contraseña inicial').fill('Mostrador!2026e2e');
  await create.getByRole('combobox', { name: 'Sucursal' }).selectOption({ label: branchName });
  // El nombre accesible del checkbox incluye la pista del label ("N permisos").
  await create.getByRole('checkbox', { name: new RegExp(`^${roleName}`) }).check();
  await create.getByRole('button', { name: 'Crear' }).click();

  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // "Activo" tambien aparece en la tabla de roles: el estado del usuario va en el encabezado.
  await expect(page.locator('header').getByText('Activo', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
  const row = page.getByRole('row', { name: new RegExp(email) });
  await expect(row).toContainText(roleName);
  await expect(row).toContainText(branchName);
  await expect(row).toContainText('Activo');
});
