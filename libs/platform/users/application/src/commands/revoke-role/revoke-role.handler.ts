import { Inject, Injectable } from '@nestjs/common';

import { EntityId, UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { type UserId, UserNotFoundError } from '@platform/users/domain';

import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { RevokeRoleCommand } from './revoke-role.command';

@Injectable()
export class RevokeRoleHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RevokeRoleCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    user.revokeRole(command.roleId);

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
    });
  }
}
