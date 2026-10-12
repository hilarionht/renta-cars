import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  DuplicateRoleNameError,
  Permission,
  Role,
  type RoleId,
  RoleName,
} from '@platform/roles-permissions/domain';

import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import type { CreateRoleCommand } from './create-role.command';

@Injectable()
export class CreateRoleHandler {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateRoleCommand): Promise<RoleId> {
    const roleName = RoleName.from(command.roleName);
    const permissions = command.permissions.map((p) => Permission.from(p));

    const existing = await this.roleRepository.findByCompanyAndName(
      command.companyId,
      roleName.toString(),
    );
    if (existing) {
      throw new DuplicateRoleNameError(roleName.toString());
    }

    const role = Role.create({
      companyId: command.companyId,
      roleName,
      scope: 'Custom',
      permissions,
    });

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

    return role.id;
  }
}
