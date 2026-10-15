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

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = user.version;
    user.assignRole(command.roleId);
    if (user.version === versionBefore) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
    });
  }
}
