import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  EncryptedMfaSecret,
  InvalidMfaCodeError,
  type UserId,
  UserNotFoundError,
} from '@platform/users/domain';

import { MFA_SECRET_CIPHER_PORT, type MfaSecretCipher } from '../../ports/mfa-secret-cipher.port';
import { MFA_TOTP_PORT, type MfaTotpPort } from '../../ports/mfa-totp.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { ConfirmMfaEnrollmentCommand } from './confirm-mfa-enrollment.command';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - el secret todavia no esta persistido
// en ningun lado (UserMfaController.enroll() lo genero stateless, MFA_TOTP_PORT.generateSecret()
// sin side-effects) - este handler es quien recien lo cifra y lo guarda, solo despues de
// confirmar que el cliente efectivamente lo cargo en su app autenticadora (prueba de
// posesion: el codigo presentado debe verificar contra ESTE secret).
@Injectable()
export class ConfirmMfaEnrollmentHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MFA_TOTP_PORT) private readonly totp: MfaTotpPort,
    @Inject(MFA_SECRET_CIPHER_PORT) private readonly secretCipher: MfaSecretCipher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ConfirmMfaEnrollmentCommand): Promise<void> {
    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    const codeIsValid = await this.totp.verifyCode(command.secret, command.code);
    if (!codeIsValid) {
      throw new InvalidMfaCodeError();
    }

    const encryptedSecret = EncryptedMfaSecret.fromEncrypted(
      this.secretCipher.encrypt(command.secret),
    );
    user.enableMfa(encryptedSecret);

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
