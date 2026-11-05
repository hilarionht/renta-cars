import { uniqueSuffix } from '../../../tooling/testing/seed/api-seed';
import { dateInDays, expect, open, test } from './support/fixtures';

// docs/persistence/10-DECISIONES.md #155: sucursales, roles propios y categorias con tarifa. La
// empresa es la misma para todos los recorridos (#154): cada test crea lo suyo con nombre unico
// y solo cierra o desactiva lo que creo (nunca la sucursal del global-setup).

test('sucursal: alta, cierre y reapertura', async ({ page, api }) => {
  void api; // la fixture deja la sesion del usuario en el contexto
  const name = `Sucursal E2E ${uniqueSuffix()}`;

  await open(page, '/admin/branches');
  await page.getByRole('link', { name: 'Nueva sucursal' }).click();
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Calle y número').fill('Av. Corrientes 1234');
  await page.getByLabel('Ciudad').fill('Buenos Aires');
  await page.getByRole('button', { name: 'Crear sucursal' }).click();

  await expect(page).toHaveURL(/\/admin\/branches\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Abierta', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sucursal' }).click();
  const close = page.getByRole('dialog', { name: `Cerrar ${name}` });
  await close.getByRole('button', { name: 'Cerrar sucursal' }).click();
  await expect(close).toBeHidden();
  await expect(page.getByText('Cerrada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText('Abierta', { exact: true })).toBeVisible();
});

test('rol propio: alta, permisos y desactivacion', async ({ page, api }) => {
  void api;
  const name = `Rol E2E ${uniqueSuffix()}`;

  await open(page, '/admin/roles');
  await page.getByRole('button', { name: 'Nuevo rol' }).click();
  const create = page.getByRole('dialog', { name: 'Nuevo rol' });
  await create.getByLabel('Nombre').fill(name);
  await create
    .getByRole('group', { name: 'Reservas' })
    .getByRole('checkbox', { name: /^Create/ })
    .check();
  await create.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(create).toBeHidden();

  await expect(page).toHaveURL(/\/admin\/roles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Permisos (1)' })).toBeVisible();

  await page
    .getByRole('group', { name: 'Reservas' })
    .getByRole('checkbox', { name: /^Cancel/ })
    .check();
  await page.getByRole('button', { name: 'Guardar permisos' }).click();
  await expect(page.getByText('Permisos guardados. Se aplican enseguida.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Permisos (2)' })).toBeVisible();

  await page.getByRole('button', { name: 'Desactivar' }).click();
  const deactivate = page.getByRole('dialog', { name: `Desactivar ${name}` });
  await deactivate.getByRole('button', { name: 'Desactivar' }).click();
  await expect(deactivate).toBeHidden();
  await expect(page.getByText('Desactivado', { exact: true })).toBeVisible();
});

test('categoria: alta y tarifa', async ({ page, api }) => {
  void api;
  const name = `Categoria E2E ${uniqueSuffix()}`;

  await open(page, '/fleet/categories');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const create = page.getByRole('dialog', { name: 'Nueva categoría' });
  await create.getByLabel('Nombre').fill(name);
  await create.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(create).toBeHidden();

  await expect(page).toHaveURL(/\/fleet\/categories\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('button', { name: 'Agregar tarifa' }).click();
  const rate = page.getByRole('dialog', { name: 'Agregar tarifa' });
  await rate.getByLabel('Monto').fill('45000');
  await rate.getByLabel('Moneda').fill('ARS');
  await rate.getByLabel('Unidad').selectOption('Week');
  await rate.getByLabel('Vigente desde').fill(dateInDays(1));
  await rate.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(rate).toBeHidden();

  const rates = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Tarifas' }) });
  await expect(rates.getByRole('row', { name: /Por semana/ })).toContainText(dateInDays(1));
});
