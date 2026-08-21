import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SecurityDepositNotFoundError } from '@platform/payments/domain';

import { PAYMENT_GATEWAY_PORT, type PaymentGatewayPort } from '../../ports/payment-gateway.port';
import {
  SECURITY_DEPOSIT_REPOSITORY,
  type SecurityDepositRepository,
} from '../../ports/security-deposit.repository';
import type { ReleaseSecurityDepositCommand } from './release-security-deposit.command';

@Injectable()
export class ReleaseSecurityDepositHandler {
  constructor(
    @Inject(SECURITY_DEPOSIT_REPOSITORY)
    private readonly securityDepositRepository: SecurityDepositRepository,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly paymentGateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ReleaseSecurityDepositCommand): Promise<void> {
    const deposit = await this.securityDepositRepository.findById(
      EntityId.from(command.securityDepositId),
    );
    if (!deposit || deposit.companyId !== command.companyId) {
      throw new SecurityDepositNotFoundError(command.securityDepositId);
    }

    if (deposit.gatewayHoldReference) {
      await this.paymentGateway.refund({
        gatewayReference: deposit.gatewayHoldReference,
        amount: { minorUnits: deposit.amount.minorUnits, currency: deposit.amount.currencyCode },
      });
    }
    deposit.release();

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
    });
  }
}
