import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SecurityDepositNotFoundError } from '@platform/payments/domain';

import {
  SECURITY_DEPOSIT_REPOSITORY,
  type SecurityDepositRepository,
} from '../../ports/security-deposit.repository';
import type { RetainSecurityDepositCommand } from './retain-security-deposit.command';

// retain() nunca libera una eventual preautorizacion (a diferencia de release()) - el monto
// retenido se cobra por una via separada (un Payment normal contra el gateway), no es
// responsabilidad de este handler.
@Injectable()
export class RetainSecurityDepositHandler {
  constructor(
    @Inject(SECURITY_DEPOSIT_REPOSITORY)
    private readonly securityDepositRepository: SecurityDepositRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RetainSecurityDepositCommand): Promise<void> {
    const deposit = await this.securityDepositRepository.findById(
      EntityId.from(command.securityDepositId),
      command.companyId,
    );
    if (!deposit || deposit.companyId !== command.companyId) {
      throw new SecurityDepositNotFoundError(command.securityDepositId);
    }

    deposit.retain(Money.from(command.retainedAmountMinorUnits, command.currency), command.reason);

    await this.unitOfWork.run(async (tx) => {
      await this.securityDepositRepository.save(deposit, tx);
      for (const event of deposit.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'SecurityDeposit',
          aggregateId: deposit.id.toString(),
          companyId: deposit.companyId,
          payload: { ...event },
        });
      }
    }, command.companyId);
  }
}
