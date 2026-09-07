import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PasswordHash, type UserId, UserNotFoundError } from '@platform/users/domain';

import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { ChangePasswordCommand } from './change-password.command';

@Injectable()
export class ChangePasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    const newHash = PasswordHash.fromHash(await this.passwordHasher.hash(command.newPassword));
    user.changePassword(newHash, command.changedBy);

    await this.unitOfWork.run(async (tx) => {
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
