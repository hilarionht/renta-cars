import { Inject, Injectable } from '@nestjs/common';

import { EntityId, UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { type UserId, UserNotFoundError } from '@platform/users/domain';

import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { ReactivateUserCommand } from './reactivate-user.command';

// Sin evento de dominio propio (no esta en docs/model/06-DOMAIN_EVENTS.md SS3, a diferencia
// de UserDisabled.v1) - no se agrega uno nuevo aca para no repetir la extension puntual ya
// hecha con RoleStatus/RoleDeactivated.v1 en cada caso de uso; el propio UPDATE queda en el
// log de auditoria de base si hiciera falta reconstruirlo.
@Injectable()
export class ReactivateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ReactivateUserCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    user.reactivate();

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
    });
  }
}
