import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { InvalidMfaCodeError, type UserId, UserNotFoundError } from '@platform/users/domain';

import { MFA_SECRET_CIPHER_PORT, type MfaSecretCipher } from '../../ports/mfa-secret-cipher.port';
import { MFA_TOTP_PORT, type MfaTotpPort } from '../../ports/mfa-totp.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { DisableMfaCommand } from './disable-mfa.command';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - exige el codigo TOTP ACTUAL como
// prueba de posesion antes de deshabilitar (no basta con estar autenticado - el objetivo es
// evitar que una sesion robada por si sola pueda bajar la guardia de MFA). Idempotente si ya
// esta deshabilitado (mismo criterio que User.disable()/reactivate()) - un doble click no
// debe exigir un codigo que ya no tiene sentido pedir.
@Injectable()
export class DisableMfaHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MFA_TOTP_PORT) private readonly totp: MfaTotpPort,
    @Inject(MFA_SECRET_CIPHER_PORT) private readonly secretCipher: MfaSecretCipher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DisableMfaCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return;
    }

    const secret = this.secretCipher.decrypt(user.mfaSecret.toString());
    const codeIsValid = await this.totp.verifyCode(secret, command.code);
    if (!codeIsValid) {
      throw new InvalidMfaCodeError();
    }

    user.disableMfa();

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
