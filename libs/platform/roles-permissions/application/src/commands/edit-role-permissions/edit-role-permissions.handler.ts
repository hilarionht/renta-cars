import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  Permission,
  type RoleId,
  RoleNotFoundError,
  SystemRoleImmutableError,
} from '@platform/roles-permissions/domain';

import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import { LastAdministratorGuard } from '../../services/last-administrator.guard';
import type { EditRolePermissionsCommand } from './edit-role-permissions.command';

@Injectable()
export class EditRolePermissionsHandler {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    private readonly lastAdministratorGuard: LastAdministratorGuard,
  ) {}

  async execute(command: EditRolePermissionsCommand): Promise<void> {
    // #140: primero la lectura liviana por el id crudo - un role System (inmutable) responde 403
    // sin cargar el agregado (los System de los seeds viejos tienen id v4 y daban 500).
    const summary = await this.roleRepository.findSummaryById(command.roleId);
    // Un Custom role de otra company no existe desde la perspectiva de esta request - mismo
    // codigo (RESOURCE_NOT_FOUND) que un id inexistente, nunca revela que el recurso existe
    // en otro tenant (docs/09-SEGURIDAD.md SS5).
    if (!summary || (summary.scope === 'Custom' && summary.companyId !== command.companyId)) {
      throw new RoleNotFoundError(command.roleId);
    }
    if (summary.scope === 'System') {
      throw new SystemRoleImmutableError(command.roleId);
    }

    const roleId: RoleId = EntityId.from(command.roleId);
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new RoleNotFoundError(command.roleId);
    }

    const permissions = command.permissions.map((p) => Permission.from(p));
    role.editPermissions(permissions);

    await this.unitOfWork.run(async (tx) => {
      // #140: un role activo puede perder users:assign-role o roles:create.
      if (role.status === 'Active') {
        await this.lastAdministratorGuard.assertAdministratorRemains(tx, command.companyId, {
          kind: 'edit-role-permissions',
          roleId: command.roleId,
          permissions: command.permissions,
        });
      }
      await this.roleRepository.save(role, tx);
      for (const event of role.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Role',
          aggregateId: role.id.toString(),
          companyId: role.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
