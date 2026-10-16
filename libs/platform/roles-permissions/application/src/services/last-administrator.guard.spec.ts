import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { LastAdministratorError } from '@platform/roles-permissions/domain';

import type { ActiveRoleAssignment, RoleAssignmentsPort } from '../ports/role-assignments.port';
import {
  applyChange,
  countAdministrators,
  LastAdministratorGuard,
} from './last-administrator.guard';

// docs/persistence/10-DECISIONES.md #140: la company siempre conserva un administrador.
const ADMIN = ['users:assign-role', 'roles:create', 'users:create'];
const assignment = (
  userId: string,
  roleId: string,
  permissions: string[],
): ActiveRoleAssignment => ({
  userId,
  roleId,
  permissions,
});

describe('countAdministrators', () => {
  it('cuenta usuarios con los dos permisos, sumando todos sus roles', () => {
    expect(
      countAdministrators([
        assignment('u1', 'r1', ['users:assign-role']),
        assignment('u1', 'r2', ['roles:create']),
        assignment('u2', 'r1', ['users:assign-role']),
      ]),
    ).toBe(1);
  });
});

describe('applyChange', () => {
  const base = [assignment('u1', 'r1', ADMIN), assignment('u2', 'r2', ['users:create'])];

  it('deshabilitar saca todas las asignaciones del usuario', () => {
    expect(countAdministrators(applyChange(base, { kind: 'disable-user', userId: 'u1' }))).toBe(0);
  });

  it('revocar saca solo ese rol de ese usuario', () => {
    const after = applyChange(base, { kind: 'revoke-role', userId: 'u1', roleId: 'r2' });
    expect(countAdministrators(after)).toBe(1);
  });

  it('editar permisos los reemplaza en todos los usuarios del rol', () => {
    const after = applyChange(base, {
      kind: 'edit-role-permissions',
      roleId: 'r1',
      permissions: ['users:create'],
    });
    expect(countAdministrators(after)).toBe(0);
  });
});

describe('LastAdministratorGuard', () => {
  function guardWith(assignments: ActiveRoleAssignment[]) {
    const port: RoleAssignmentsPort = {
      lockAndListActiveAssignments: jest.fn().mockResolvedValue(assignments),
      findUserIdsWithRole: jest.fn(),
    };
    return { guard: new LastAdministratorGuard(port), port };
  }

  it('rechaza si la company se queda sin administrador', async () => {
    const { guard } = guardWith([assignment('u1', 'r1', ADMIN)]);
    await expect(
      guard.assertAdministratorRemains({}, 'c1', { kind: 'disable-user', userId: 'u1' }),
    ).rejects.toThrow(LastAdministratorError);
  });

  it('permite si queda otro administrador', async () => {
    const { guard } = guardWith([assignment('u1', 'r1', ADMIN), assignment('u2', 'r1', ADMIN)]);
    await expect(
      guard.assertAdministratorRemains({}, 'c1', { kind: 'disable-user', userId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('no bloquea si la company ya no tenia administradores', async () => {
    const { guard } = guardWith([assignment('u1', 'r1', ['users:create'])]);
    await expect(
      guard.assertAdministratorRemains({}, 'c1', { kind: 'disable-user', userId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('toma el lock dentro de la transaccion recibida', async () => {
    const { guard, port } = guardWith([
      assignment('u1', 'r1', ADMIN),
      assignment('u2', 'r1', ADMIN),
    ]);
    const tx = { marker: true } as unknown as UnitOfWorkTransaction;
    await guard.assertAdministratorRemains(tx, 'c1', { kind: 'disable-user', userId: 'u1' });
    expect(port.lockAndListActiveAssignments).toHaveBeenCalledWith(tx, 'c1');
  });
});
