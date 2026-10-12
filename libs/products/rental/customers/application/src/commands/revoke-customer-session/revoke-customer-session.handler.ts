import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';

import {
  CUSTOMER_REFRESH_TOKEN_HASHER,
  type CustomerRefreshTokenHasher,
} from '../../ports/customer-refresh-token-hasher.port';
import {
  CUSTOMER_SESSION_REPOSITORY,
  type CustomerSessionRepository,
} from '../../ports/customer-session.repository';
import type { RevokeCustomerSessionCommand } from './revoke-customer-session.command';

// Espejo deliberado de platform/identity/application/src/commands/revoke-session/
// revoke-session.handler.ts - logout idempotente por diseño, ver ese archivo.
@Injectable()
export class RevokeCustomerSessionHandler {
  constructor(
    @Inject(CUSTOMER_SESSION_REPOSITORY)
    private readonly customerSessionRepository: CustomerSessionRepository,
    @Inject(CUSTOMER_REFRESH_TOKEN_HASHER)
    private readonly refreshTokenHasher: CustomerRefreshTokenHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RevokeCustomerSessionCommand): Promise<void> {
    const hash = this.refreshTokenHasher.hash(command.refreshToken);
    const session = await this.customerSessionRepository.findByRefreshTokenHash(hash);
    if (!session || session.status !== 'Active') {
      return;
    }

    session.revoke(command.reason);

    await this.unitOfWork.run(async (tx) => {
      await this.customerSessionRepository.save(session, tx);
      for (const event of session.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'CustomerSession',
          aggregateId: session.id.toString(),
          companyId: session.companyId,
          payload: { ...event },
        });
      }
    }, session.companyId);
  }
}
