import { Inject, Injectable } from '@nestjs/common';

import { UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { PasswordResetChallenge, PasswordResetTokenHash } from '@platform/users/domain';
import { SendNotificationHandler } from '@platform/notifications/application';

import {
  PASSWORD_RESET_CHALLENGE_REPOSITORY,
  type PasswordResetChallengeRepository,
} from '../../ports/password-reset-challenge.repository';
import {
  PASSWORD_RESET_TOKEN_HASHER,
  type PasswordResetTokenHasher,
} from '../../ports/password-reset-token-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import type { RequestPasswordResetCommand } from './request-password-reset.command';

// docs/persistence/10-DECISIONES.md #113 - 30 min de vigencia, baseline nuevo no dictado por
// ningun doc, explicitamente no final (mismo framing que AUTH_THROTTLE_PROFILE). Sin
// maxAttempts - el token de 32 bytes es la defensa (ver PasswordResetChallenge).
const RESET_TOKEN_EXPIRATION_MS = 30 * 60 * 1000;

@Injectable()
export class RequestPasswordResetHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_RESET_CHALLENGE_REPOSITORY)
    private readonly challengeRepository: PasswordResetChallengeRepository,
    @Inject(PASSWORD_RESET_TOKEN_HASHER) private readonly tokenHasher: PasswordResetTokenHasher,
    private readonly sendNotification: SendNotificationHandler,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  // Anti-enumeracion (mismo criterio que RequestCustomerOtpHandler): un email que no
  // pertenece a ningun User de la company es un no-op silencioso, nunca un error - el
  // caller (AuthController) siempre responde 201 sin importar si el email existe.
  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const user = await this.userRepository.findByCompanyAndEmail(command.companyId, command.email);
    if (!user) {
      return;
    }

    const { plaintext, hash } = this.tokenHasher.generate();
    const challenge = PasswordResetChallenge.request({
      companyId: user.companyId,
      userId: user.id.toString(),
      tokenHash: PasswordResetTokenHash.fromHash(hash),
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRATION_MS),
    });

    await this.unitOfWork.run(async (tx) => {
      await this.challengeRepository.save(challenge, tx);
    }, user.companyId);

    // requireExactChannel: 'Email' - User no tiene telefono (a diferencia de Customer), es
    // el unico canal posible. Sin fallback a WhatsApp/SMS.
    await this.sendNotification.execute({
      companyId: user.companyId,
      kind: 'SecurityCode',
      recipient: { email: user.email.toString() },
      templateId: 'user-password-reset',
      templateParams: { token: plaintext },
      requireExactChannel: 'Email',
    });
  }
}
