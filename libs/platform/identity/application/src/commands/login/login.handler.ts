import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  DeviceContext,
  InvalidCredentialsError,
  RefreshTokenHash,
  Session,
  UserDisabledError,
} from '@platform/identity/domain';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
  USER_LOOKUP_PORT,
  type UserLookupPort,
} from '@platform/users/application';

import {
  REFRESH_TOKEN_HASHER,
  type RefreshTokenHasher,
} from '../../ports/refresh-token-hasher.port';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';
import { TOKEN_SIGNER, type TokenSigner } from '../../ports/token-signer.port';
import type { LoginCommand, LoginResult } from './login.command';

@Injectable()
export class LoginHandler {
  constructor(
    @Inject(USER_LOOKUP_PORT) private readonly userLookup: UserLookupPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(REFRESH_TOKEN_HASHER) private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(TOKEN_SIGNER) private readonly tokenSigner: TokenSigner,
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

    const { plaintext, hash } = this.refreshTokenHasher.generate();
    const session = Session.issue({
      userId: user.userId,
      companyId: user.companyId,
      refreshTokenHash: RefreshTokenHash.fromHash(hash),
      deviceContext: DeviceContext.from({
        userAgent: command.userAgent,
        ipAddress: command.ipAddress,
      }),
    });

    const accessToken = this.tokenSigner.signAccessToken({
      sub: user.userId,
      companyId: user.companyId,
      branchId: user.branchId,
      roles: user.roles,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.sessionRepository.save(session, tx);
      for (const event of session.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Session',
          aggregateId: session.id.toString(),
          companyId: session.companyId,
          payload: { ...event },
        });
      }
    }, session.companyId);

    return { accessToken, refreshToken: plaintext, sessionId: session.id.toString() };
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
