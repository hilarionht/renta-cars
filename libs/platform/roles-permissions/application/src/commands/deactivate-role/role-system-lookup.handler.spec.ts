import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  Permission,
  Role,
  RoleHasUsersError,
  RoleName,
  RoleNotFoundError,
  SystemRoleImmutableError,
} from '@platform/roles-permissions/domain';

import type { RoleAssignmentsPort } from '../../ports/role-assignments.port';
import type { RoleRecordSummary, RoleRepository } from '../../ports/role.repository';
import type { LastAdministratorGuard } from '../../services/last-administrator.guard';
import { EditRolePermissionsHandler } from '../edit-role-permissions/edit-role-permissions.handler';
import { DeactivateRoleHandler } from './deactivate-role.handler';

// docs/persistence/10-DECISIONES.md #140: el role se decide por una lectura liviana del id crudo
// (los System de seeds viejos tienen id v4 y EntityId.from exige v7: daban 500), y desactivar
// uno ya inactivo no guarda (antes respondia un CONCURRENT_MODIFICATION espurio).
function customRole(): Role {
  return Role.create({
    companyId: 'company-1',
    roleName: RoleName.from('Mostrador'),
    scope: 'Custom',
    permissions: [Permission.from('reservations:create')],
  });
}

function build(
  summary: RoleRecordSummary | null,
  role: Role | null = null,
  userIds: string[] = [],
) {
  const roleRepository: RoleRepository = {
    findById: jest.fn().mockResolvedValue(role),
    findSummaryById: jest.fn().mockResolvedValue(summary),
    existsWithName: jest.fn(),
    findAllForCompany: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const roleAssignments: RoleAssignmentsPort = {
    lockAndListActiveAssignments: jest.fn(),
    findUserIdsWithRole: jest.fn().mockResolvedValue(userIds),
  };
  return {
    roleRepository,
    roleAssignments,
    deactivate: new DeactivateRoleHandler(
      roleRepository,
      unitOfWork,
      eventPublisher,
      roleAssignments,
    ),
    edit: new EditRolePermissionsHandler(roleRepository, unitOfWork, eventPublisher, {
      assertAdministratorRemains: jest.fn(),
    } as unknown as LastAdministratorGuard),
  };
}

// Id v4 a proposito: si el handler llamara a EntityId.from antes de decidir, fallaria con TypeError.
const V4_ID = '36008a9d-cc96-4adc-84d7-d43ba79518dd';

describe('roles: lookup liviano antes de cargar el agregado', () => {
  it('un role System responde 403 (SystemRoleImmutableError) sin cargarlo, aunque su id sea v4', async () => {
    const { deactivate, edit, roleRepository } = build({
      scope: 'System',
      companyId: null,
      status: 'Active',
    });

    await expect(deactivate.execute({ companyId: 'company-1', roleId: V4_ID })).rejects.toThrow(
      SystemRoleImmutableError,
    );
    await expect(
      edit.execute({ companyId: 'company-1', roleId: V4_ID, permissions: ['reservations:create'] }),
    ).rejects.toThrow(SystemRoleImmutableError);
    expect(roleRepository.findById).not.toHaveBeenCalled();
  });

  it('un role Custom de otra company responde como inexistente', async () => {
    const { deactivate } = build({ scope: 'Custom', companyId: 'company-2', status: 'Active' });

    await expect(deactivate.execute({ companyId: 'company-1', roleId: V4_ID })).rejects.toThrow(
      RoleNotFoundError,
    );
  });

  it('desactivar un role ya inactivo no guarda (no-op idempotente)', async () => {
    const role = customRole();
    role.deactivate();
    const { deactivate, roleRepository } = build(
      { scope: 'Custom', companyId: 'company-1', status: 'Inactive' },
      role,
    );

    await deactivate.execute({ companyId: 'company-1', roleId: role.id.toString() });

    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  // #140: decision del usuario.
  it('desactivar un role con usuarios responde 409 (RoleHasUsersError) y no guarda', async () => {
    const role = customRole();
    const { deactivate, roleRepository } = build(
      { scope: 'Custom', companyId: 'company-1', status: 'Active' },
      role,
      ['user-1'],
    );

    await expect(
      deactivate.execute({ companyId: 'company-1', roleId: role.id.toString() }),
    ).rejects.toThrow(RoleHasUsersError);
    expect(roleRepository.save).not.toHaveBeenCalled();
  });
});
