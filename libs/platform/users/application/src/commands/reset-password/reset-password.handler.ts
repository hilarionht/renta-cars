import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PasswordHash, PasswordResetTokenInvalidError, type UserId } from '@platform/users/domain';

import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher.port';
import {
  PASSWORD_RESET_CHALLENGE_REPOSITORY,
  type PasswordResetChallengeRepository,
} from '../../ports/password-reset-challenge.repository';
import {
  PASSWORD_RESET_TOKEN_HASHER,
  type PasswordResetTokenHasher,
} from '../../ports/password-reset-token-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { ResetPasswordCommand } from './reset-password.command';

@Injectable()
export class ResetPasswordHandler {
  constructor(
    @Inject(PASSWORD_RESET_CHALLENGE_REPOSITORY)
    private readonly challengeRepository: PasswordResetChallengeRepository,
    @Inject(PASSWORD_RESET_TOKEN_HASHER) private readonly tokenHasher: PasswordResetTokenHasher,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const hash = this.tokenHasher.hash(command.token);
    const challenge = await this.challengeRepository.findByTokenHash(hash);

    if (!challenge) {
      // companyId genuinamente desconocido - ningun evento, mismo criterio que
      // RefreshSessionHandler cuando findByRefreshTokenHash no encuentra nada.
      throw new PasswordResetTokenInvalidError();
    }

    if (challenge.status !== 'Pending') {
      // Reintento de un token ya consumido/expirado - auditado, mismo criterio que
      // SessionTheftDetected.v1 (RefreshSessionHandler). Nada que guardar (la entidad no
      // cambio), solo el evento.
      await this.unitOfWork.run(async (tx) => {
        await this.eventPublisher.publish(tx, {
          eventType: 'PasswordResetTokenReplayed.v1',
          aggregateType: 'PasswordResetChallenge',
          aggregateId: challenge.id.toString(),
          companyId: challenge.companyId,
          payload: { challengeId: challenge.id.toString(), userId: challenge.userId },
        });
      }, challenge.companyId);

      throw new PasswordResetTokenInvalidError();
    }

    const outcome = challenge.attemptConsume(new Date());

    if (outcome !== 'Verified') {
      // Expiro recien (primer toque) - se persiste la transicion, sin evento de replay (es
      // un descubrimiento, no un reuso).
      await this.unitOfWork.run(async (tx) => {
        await this.challengeRepository.save(challenge, tx);
      }, challenge.companyId);

      throw new PasswordResetTokenInvalidError();
    }

    const userId: UserId = EntityId.from(challenge.userId);
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new PasswordResetTokenInvalidError();
    }

    const newHash = PasswordHash.fromHash(await this.passwordHasher.hash(command.newPassword));
    user.changePassword(newHash, user.id.toString());

    await this.unitOfWork.run(async (tx) => {
      await this.challengeRepository.save(challenge, tx);
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
    }, challenge.companyId);
  }
}
