import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { Permission, type RoleId, RoleNotFoundError } from '@platform/roles-permissions/domain';

import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import type { EditRolePermissionsCommand } from './edit-role-permissions.command';

@Injectable()
export class EditRolePermissionsHandler {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: EditRolePermissionsCommand): Promise<void> {
    const roleId: RoleId = EntityId.from(command.roleId);
    const role = await this.roleRepository.findById(roleId);

    // Un Custom role de otra company no existe desde la perspectiva de esta request - mismo
    // codigo (RESOURCE_NOT_FOUND) que un id inexistente, nunca revela que el recurso existe
    // en otro tenant (docs/09-SEGURIDAD.md SS5).
    if (!role || (role.scope === 'Custom' && role.companyId !== command.companyId)) {
      throw new RoleNotFoundError(command.roleId);
    }

    const permissions = command.permissions.map((p) => Permission.from(p));
    role.editPermissions(permissions);

    await this.unitOfWork.run(async (tx) => {
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
