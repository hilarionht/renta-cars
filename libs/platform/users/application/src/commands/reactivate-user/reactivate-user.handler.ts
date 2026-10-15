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

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = user.version;
    user.reactivate();
    if (user.version === versionBefore) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
    });
  }
}
