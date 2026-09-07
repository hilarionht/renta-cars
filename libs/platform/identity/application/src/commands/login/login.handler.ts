import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  InvalidCredentialsError,
  MfaLoginChallenge,
  UserDisabledError,
} from '@platform/identity/domain';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
  USER_LOOKUP_PORT,
  type UserLookupPort,
} from '@platform/users/application';

import {
  MFA_LOGIN_CHALLENGE_REPOSITORY,
  type MfaLoginChallengeRepository,
} from '../../ports/mfa-login-challenge.repository';
import { SessionIssuer } from '../../services/session-issuer';
import type { LoginCommand, LoginResult } from './login.command';

// Mismo criterio que CustomerOtpChallenge (5 min, 5 intentos) - tiempo suficiente para abrir
// la app autenticadora y escribir el codigo, tope acotado contra fuerza bruta.
const MFA_CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;
const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

@Injectable()
export class LoginHandler {
  constructor(
    @Inject(USER_LOOKUP_PORT) private readonly userLookup: UserLookupPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(MFA_LOGIN_CHALLENGE_REPOSITORY)
    private readonly mfaLoginChallengeRepository: MfaLoginChallengeRepository,
    private readonly sessionIssuer: SessionIssuer,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userLookup.findByCompanyAndEmail(command.companyId, command.email);

    if (!user) {
      await this.publishLoginFailed(command, 'unknown_email');
      throw new InvalidCredentialsError();
    }

    if (user.status === 'Disabled') {
      await this.publishLoginFailed(command, 'user_disabled');
      throw new UserDisabledError(user.userId);
    }

    const passwordMatches = await this.passwordHasher.verify(user.passwordHash, command.password);
    if (!passwordMatches) {
      await this.publishLoginFailed(command, 'invalid_password');
      throw new InvalidCredentialsError();
    }

    if (user.mfaEnabled) {
      const challenge = MfaLoginChallenge.request({
        companyId: user.companyId,
        userId: user.userId,
        expiresAt: new Date(Date.now() + MFA_CHALLENGE_EXPIRATION_MS),
        maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS,
      });

      await this.unitOfWork.run(async (tx) => {
        await this.mfaLoginChallengeRepository.save(challenge, tx);
      }, user.companyId);

      return { status: 'mfa_required', mfaChallengeId: challenge.id.toString() };
    }

    const issued = await this.sessionIssuer.issueForUser(user, {
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
    });

    return { status: 'authenticated', ...issued };
  }

  // LoginFailed.v1 se publica fuera de una transaccion de escritura de negocio (no hay
  // agregado que cambie de estado en un login fallido) - UnitOfWork.run() igual se usa aca
  // solo para obtener el SET LOCAL que Outbox necesita para su propia fila (RLS de
  // support.outbox_event).
  private async publishLoginFailed(
    command: LoginCommand,
    reason: 'unknown_email' | 'invalid_password' | 'user_disabled',
  ): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      await this.eventPublisher.publish(tx, {
        eventType: 'LoginFailed.v1',
        aggregateType: 'Session',
        aggregateId: command.email,
        companyId: command.companyId,
        payload: { email: command.email, companyId: command.companyId, reason },
      });
    }, command.companyId);
  }
}
