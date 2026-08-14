import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type RoleId, RoleNotFoundError } from '@platform/roles-permissions/domain';

import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import type { DeactivateRoleCommand } from './deactivate-role.command';

@Injectable()
export class DeactivateRoleHandler {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DeactivateRoleCommand): Promise<void> {
    const roleId: RoleId = EntityId.from(command.roleId);
    const role = await this.roleRepository.findById(roleId);

    if (!role || (role.scope === 'Custom' && role.companyId !== command.companyId)) {
      throw new RoleNotFoundError(command.roleId);
    }

    role.deactivate();

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
