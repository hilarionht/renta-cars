import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';

import {
  REFRESH_TOKEN_HASHER,
  type RefreshTokenHasher,
} from '../../ports/refresh-token-hasher.port';
import { SESSION_REPOSITORY, type SessionRepository } from '../../ports/session.repository';
import type { RevokeSessionCommand } from './revoke-session.command';

// Logout es idempotente por diseño: un refresh_token desconocido o ya revocado no es un
// error (el resultado que el cliente quiere - "no autenticado" - ya se cumple), a
// diferencia de refresh donde el mismo caso es la senal de robo.
@Injectable()
export class RevokeSessionHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(REFRESH_TOKEN_HASHER) private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    const hash = this.refreshTokenHasher.hash(command.refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(hash);
    if (!session || session.status !== 'Active') {
      return;
    }

    session.revoke(command.reason);

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
    });
  }
}
