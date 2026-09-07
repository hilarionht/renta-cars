import type { Redis } from 'ioredis';

import { CachedRoleLookupAdapter } from './cached-role-lookup.adapter';
import type { PrismaRoleLookupAdapter } from './prisma/prisma-role-lookup.adapter';

// Redis fake respaldado por un Map en memoria - simula el comportamiento real de
// get/set/del (incluye JSON.stringify/parse, igual que el adapter real) para poder probar
// hit/miss/invalidacion sin un Redis real.
function buildFakeRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  } as unknown as Redis;
}

function buildAdapter(permissionsByRole: Record<string, string[]>) {
  const getPermissionsForRoles = jest.fn((roleIds: string[]) =>
    Promise.resolve(roleIds.flatMap((roleId) => permissionsByRole[roleId] ?? [])),
  );
  const prismaAdapter = {
    existsAndBelongsToCompanyOrSystem: jest.fn(),
    getPermissionsForRoles,
  } as unknown as PrismaRoleLookupAdapter;

  const redis = buildFakeRedis();
  const adapter = new CachedRoleLookupAdapter(prismaAdapter, redis);
  return { adapter, getPermissionsForRoles, redis };
}

// Los @OnEvent son sincronicos pero invalidan via una promesa fire-and-forget (no awaitean
// deleteFromCache) - flushea microtasks antes de asertar que el cache ya se borro.
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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
    await flushMicrotasks();
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
    await flushMicrotasks();
    getPermissionsForRoles.mockClear();

    await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(getPermissionsForRoles).toHaveBeenCalledTimes(1);
  });

  it('un error de Redis en get() se trata como cache-miss, cae a Postgres', async () => {
    const { adapter, getPermissionsForRoles, redis } = buildAdapter({
      'role-a': ['customers:create'],
    });
    (redis.get as jest.Mock).mockRejectedValueOnce(new Error('redis caido'));

    const permissions = await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(permissions).toEqual(['customers:create']);
    expect(getPermissionsForRoles).toHaveBeenCalledWith(['role-a'], 'company-1');
  });

  it('un error de Redis en set() no rompe la request, solo no cachea', async () => {
    const { adapter, redis } = buildAdapter({
      'role-a': ['customers:create'],
    });
    (redis.set as jest.Mock).mockRejectedValueOnce(new Error('redis caido'));

    const permissions = await adapter.getPermissionsForRoles(['role-a'], 'company-1');

    expect(permissions).toEqual(['customers:create']);
  });

  it('existsAndBelongsToCompanyOrSystem delega directo, sin cachear', async () => {
    const existsAndBelongsToCompanyOrSystem = jest.fn().mockResolvedValue(true);
    const prismaAdapter = {
      existsAndBelongsToCompanyOrSystem,
      getPermissionsForRoles: jest.fn(),
    } as unknown as PrismaRoleLookupAdapter;
    const adapter = new CachedRoleLookupAdapter(prismaAdapter, buildFakeRedis());

    const result = await adapter.existsAndBelongsToCompanyOrSystem('role-a', 'company-1');

    expect(result).toBe(true);
    expect(existsAndBelongsToCompanyOrSystem).toHaveBeenCalledWith('role-a', 'company-1');
  });
});
