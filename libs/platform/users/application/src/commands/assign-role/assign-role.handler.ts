import { Inject, Injectable } from '@nestjs/common';

import { EntityId, UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { InvalidRoleAssignmentError, type UserId, UserNotFoundError } from '@platform/users/domain';
import { ROLE_LOOKUP_PORT, type RoleLookupPort } from '@platform/roles-permissions/application';

import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { AssignRoleCommand } from './assign-role.command';

@Injectable()
export class AssignRoleHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROLE_LOOKUP_PORT) private readonly roleLookup: RoleLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: AssignRoleCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    const valid = await this.roleLookup.existsAndBelongsToCompanyOrSystem(
      command.roleId,
      command.companyId,
    );
    if (!valid) {
      throw new InvalidRoleAssignmentError(command.roleId);
    }

    user.assignRole(command.roleId);

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
    });
  }
}
