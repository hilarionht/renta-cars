import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type UserId, UserNotFoundError } from '@platform/users/domain';
import { LastAdministratorGuard } from '@platform/roles-permissions/application';

import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { DisableUserCommand } from './disable-user.command';

@Injectable()
export class DisableUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    private readonly lastAdministratorGuard: LastAdministratorGuard,
  ) {}

  async execute(command: DisableUserCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = user.version;
    user.disable(command.disabledBy, command.reason);
    if (user.version === versionBefore) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      // #140: no deshabilitar al ultimo administrador (tampoco a uno mismo si es el unico).
      await this.lastAdministratorGuard.assertAdministratorRemains(tx, command.companyId, {
        kind: 'disable-user',
        userId: command.userId,
      });
      await this.userRepository.save(user, tx);
      for (const event of user.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'User',
          aggregateId: user.id.toString(),
          companyId: user.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
