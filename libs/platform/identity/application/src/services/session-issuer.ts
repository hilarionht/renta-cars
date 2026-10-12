import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { DeviceContext, RefreshTokenHash, Session } from '@platform/identity/domain';
import type { UserLookupResult } from '@platform/users/application';

import { REFRESH_TOKEN_HASHER, type RefreshTokenHasher } from '../ports/refresh-token-hasher.port';
import { SESSION_REPOSITORY, type SessionRepository } from '../ports/session.repository';
import { TOKEN_SIGNER, type TokenSigner } from '../ports/token-signer.port';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

// Extraccion ordinaria (no duplicacion deliberada): el tramo final de LoginHandler (armar
// RefreshTokenHash, Session.issue(), firmar access token, guardar+publicar) se factoriza
// aca para que LoginHandler (MFA deshabilitado) Y VerifyMfaLoginHandler (2do factor
// exitoso) lo reusen - mismo mecanismo de auth reusado por 2 handlers DENTRO de identity, a
// diferencia de CustomerSession/Session (2 mecanismos distintos cruzando modulos, esos SI
// se duplican a proposito). RefreshSessionHandler NO usa esto - SessionSecurityService.rotate()
// es una forma genuinamente distinta (puede devolver multiples sessionsToSave + theftDetected).
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(REFRESH_TOKEN_HASHER) private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(TOKEN_SIGNER) private readonly tokenSigner: TokenSigner,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async issueForUser(
    user: UserLookupResult,
    deviceContext: { userAgent?: string; ipAddress?: string },
  ): Promise<IssuedSession> {
    const { plaintext, hash } = this.refreshTokenHasher.generate();
    const session = Session.issue({
      userId: user.userId,
      companyId: user.companyId,
      refreshTokenHash: RefreshTokenHash.fromHash(hash),
      deviceContext: DeviceContext.from(deviceContext),
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
}
