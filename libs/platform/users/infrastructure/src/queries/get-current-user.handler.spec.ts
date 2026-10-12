import type { ReadTransaction } from '@platform/persistence-kernel';
import type { RoleLookupPort } from '@platform/roles-permissions/application';
import { UserNotFoundError } from '@platform/users/domain';

import { GetCurrentUserHandler } from './get-current-user.handler';

// docs/persistence/10-DECISIONES.md #134.
describe('GetCurrentUserHandler', () => {
  const userRecord = {
    id: 'user-1',
    email: 'admin@demo.local',
    name: 'Admin',
    status: 'Active',
    branchId: null,
    roles: [{ roleId: 'role-a' }],
  };

  function build(record: unknown, permissions: string[]) {
    const findFirst = jest.fn().mockResolvedValue(record);
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) => work({ user: { findFirst } }));
    const roleLookupPort: RoleLookupPort = {
      getPermissionsForRoles: jest.fn().mockResolvedValue(permissions),
    } as unknown as RoleLookupPort;
    const handler = new GetCurrentUserHandler(
      { run } as unknown as ReadTransaction,
      roleLookupPort,
    );
    return { handler, run, roleLookupPort };
  }

  it('devuelve el perfil y los permisos resueltos a partir de los roles del token', async () => {
    const { handler, run, roleLookupPort } = build(userRecord, [
      'reservations:create',
      'audit:read',
      'reservations:create',
    ]);

    const profile = await handler.execute({
      userId: 'user-1',
      companyId: 'company-1',
      roles: ['role-a', 'role-b'],
    });

    expect(roleLookupPort.getPermissionsForRoles).toHaveBeenCalledWith(
      ['role-a', 'role-b'],
      'company-1',
    );
    // companyId explicito: este handler no depende del RequestContext ambiente (#131).
    expect((run.mock.calls[0] as unknown[])[1]).toBe('company-1');
    expect(profile).toEqual({
      id: 'user-1',
      email: 'admin@demo.local',
      name: 'Admin',
      status: 'Active',
      roles: ['role-a'],
      branchId: undefined,
      companyId: 'company-1',
      permissions: ['audit:read', 'reservations:create'],
    });
  });

  it('lanza UserNotFoundError si el usuario no existe en la company', async () => {
    const { handler, roleLookupPort } = build(null, []);

    await expect(
      handler.execute({ userId: 'user-x', companyId: 'company-1', roles: [] }),
    ).rejects.toThrow(UserNotFoundError);
    expect(roleLookupPort.getPermissionsForRoles).not.toHaveBeenCalled();
  });
});
