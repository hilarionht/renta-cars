import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  DeviceContext,
  InvalidRefreshTokenError,
  RefreshTokenHash,
  RefreshTokenReusedError,
  SessionSecurityService,
} from '@platform/identity/domain';
import { USER_LOOKUP_PORT, type UserLookupPort } from '@platform/users/application';

import {
  REFRESH_TOKEN_HASHER,
  type RefreshTokenHasher,
} from '../../ports/refresh-token-hasher.port';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';
import { TOKEN_SIGNER, type TokenSigner } from '../../ports/token-signer.port';
import type { RefreshSessionCommand, RefreshSessionResult } from './refresh-session.command';

@Injectable()
export class RefreshSessionHandler {
  private readonly sessionSecurity = new SessionSecurityService();

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(REFRESH_TOKEN_HASHER) private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(TOKEN_SIGNER) private readonly tokenSigner: TokenSigner,
    @Inject(USER_LOOKUP_PORT) private readonly userLookup: UserLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    const presentedHash = this.refreshTokenHasher.hash(command.refreshToken);
    const matchedSession = await this.sessionRepository.findByRefreshTokenHash(presentedHash);

    if (!matchedSession) {
      throw new InvalidRefreshTokenError();
    }

    const activeSessionsForUser = await this.sessionRepository.findActiveForUser(
      matchedSession.userId,
      matchedSession.companyId,
    );
    const { hash: newHash, plaintext: newPlaintext } = this.refreshTokenHasher.generate();

    const outcome = this.sessionSecurity.rotate({
      matchedSession,
      activeSessionsForUser,
      newRefreshTokenHash: RefreshTokenHash.fromHash(newHash),
      deviceContext: DeviceContext.from({
        userAgent: command.userAgent,
        ipAddress: command.ipAddress,
      }),
    });

    await this.unitOfWork.run(async (tx) => {
      for (const session of outcome.sessionsToSave) {
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
      }

      if (outcome.theftDetected) {
        await this.eventPublisher.publish(tx, {
          eventType: 'SessionTheftDetected.v1',
          aggregateType: 'Session',
          aggregateId: matchedSession.id.toString(),
          companyId: matchedSession.companyId,
          payload: {
            userId: matchedSession.userId,
            affectedSessionIds: outcome.sessionsToSave.map((s) => s.id.toString()),
          },
        });
      }
    }, matchedSession.companyId);

    if (outcome.theftDetected || !outcome.newSession) {
      // Nunca se filtra "robo detectado" en la respuesta al cliente - reutiliza el mismo
      // camino que un token invalido comun (decision de esta tanda, ver plan).
      throw new RefreshTokenReusedError(matchedSession.userId);
    }

    const user = await this.userLookup.findById(matchedSession.userId, matchedSession.companyId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    const accessToken = this.tokenSigner.signAccessToken({
      sub: user.userId,
      companyId: user.companyId,
      branchId: user.branchId,
      roles: user.roles,
    });

    return { accessToken, refreshToken: newPlaintext, sessionId: outcome.newSession.id.toString() };
  }
}
