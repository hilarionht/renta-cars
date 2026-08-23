import { CachedRoleLookupAdapter } from './cached-role-lookup.adapter';
import type { PrismaRoleLookupAdapter } from './prisma/prisma-role-lookup.adapter';

function buildAdapter(permissionsByRole: Record<string, string[]>) {
  const getPermissionsForRoles = jest.fn((roleIds: string[]) =>
    Promise.resolve(roleIds.flatMap((roleId) => permissionsByRole[roleId] ?? [])),
  );
  const prismaAdapter = {
    existsAndBelongsToCompanyOrSystem: jest.fn(),
    getPermissionsForRoles,
  } as unknown as PrismaRoleLookupAdapter;

  const adapter = new CachedRoleLookupAdapter(prismaAdapter);
  return { adapter, getPermissionsForRoles };
}

describe('CachedRoleLookupAdapter', () => {
  it('resuelve la union de permisos de varios roles, sin duplicados', async () => {
    const { adapter } = buildAdapter({
      'role-a': ['customers:create', 'customers:edit'],
      'role-b': ['customers:edit', 'reservations:create'],
    });

    const permissions = await adapter.getPermissionsForRoles(['role-a', 'role-b'], 'company-1');

    expect(permissions.sort()).toEqual(
      ['customers:create', 'customers:edit', 'reservations:create'].sort(),
    );
  });

  it('solo pide a la DB los roleIds sin cache (miss parcial)', async () => {
    const { adapter, getPermissionsForRoles } = buildAdapter({
      'role-a': ['customers:create'],
      'role-b': ['reservations:create'],
    });

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');
    getPermissionsForRoles.mockClear();

    await adapter.getPermissionsForRoles(['role-a', 'role-b'], 'company-1');

    expect(getPermissionsForRoles).toHaveBeenCalledTimes(1);
    expect(getPermissionsForRoles).toHaveBeenCalledWith(['role-b'], 'company-1');
  });

  it('no vuelve a pedir a la DB en un hit total de cache', async () => {
    const { adapter, getPermissionsForRoles } = buildAdapter({
      'role-a': ['customers:create'],
    });

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');
    getPermissionsForRoles.mockClear();

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(getPermissionsForRoles).not.toHaveBeenCalled();
  });

  it('RolePermissionsChanged.v1 invalida el cache del role afectado', async () => {
    const { adapter, getPermissionsForRoles } = buildAdapter({
      'role-a': ['customers:create'],
    });

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');
    adapter.onPermissionsChanged({
      eventType: 'RolePermissionsChanged.v1',
      aggregateType: 'Role',
      aggregateId: 'role-a',
      companyId: 'company-1',
      payload: { roleId: 'role-a' },
      occurredAt: new Date(),
    });
    getPermissionsForRoles.mockClear();

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(getPermissionsForRoles).toHaveBeenCalledTimes(1);
  });

  it('RoleDeactivated.v1 invalida el cache del role afectado', async () => {
    const { adapter, getPermissionsForRoles } = buildAdapter({
      'role-a': ['customers:create'],
    });

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');
    adapter.onRoleDeactivated({
      eventType: 'RoleDeactivated.v1',
      aggregateType: 'Role',
      aggregateId: 'role-a',
      companyId: 'company-1',
      payload: { roleId: 'role-a' },
      occurredAt: new Date(),
    });
    getPermissionsForRoles.mockClear();

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(getPermissionsForRoles).toHaveBeenCalledTimes(1);
  });

  it('existsAndBelongsToCompanyOrSystem delega directo, sin cachear', async () => {
    const existsAndBelongsToCompanyOrSystem = jest.fn().mockResolvedValue(true);
    const prismaAdapter = {
      existsAndBelongsToCompanyOrSystem,
      getPermissionsForRoles: jest.fn(),
    } as unknown as PrismaRoleLookupAdapter;
    const adapter = new CachedRoleLookupAdapter(prismaAdapter);

    const result = await adapter.existsAndBelongsToCompanyOrSystem('role-a', 'company-1');

    expect(result).toBe(true);
    expect(existsAndBelongsToCompanyOrSystem).toHaveBeenCalledWith('role-a', 'company-1');
  });
});
