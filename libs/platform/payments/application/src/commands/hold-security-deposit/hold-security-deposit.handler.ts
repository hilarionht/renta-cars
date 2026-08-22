import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SecurityDeposit, type SecurityDepositId } from '@platform/payments/domain';

import {
  SECURITY_DEPOSIT_REPOSITORY,
  type SecurityDepositRepository,
} from '../../ports/security-deposit.repository';
import type { HoldSecurityDepositCommand } from './hold-security-deposit.command';

// hold() nunca llama al gateway aqui: la Reservation no modela un PaymentMethod elegido
// (docs/model/02-AGGREGATES.md SS11), asi que no hay forma de saber si corresponde una
// preautorizacion de tarjeta en el momento del listener de ReservationConfirmed.v1. Si en el
// futuro se requiere una preautorizacion real, se modela como un Payment normal
// (targetType: 'SecurityDeposit', targetId: deposit.id) vía RequestPaymentHandler +
// AuthorizePaymentHandler - gatewayHoldReference queda disponible para ese caso pero esta
// tanda no lo puebla automaticamente.
@Injectable()
export class HoldSecurityDepositHandler {
  constructor(
    @Inject(SECURITY_DEPOSIT_REPOSITORY)
    private readonly securityDepositRepository: SecurityDepositRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: HoldSecurityDepositCommand): Promise<SecurityDepositId> {
    const deposit = SecurityDeposit.hold({
      companyId: command.companyId,
      reservationId: command.reservationId,
      amount: Money.from(command.amountMinorUnits, command.currency),
    });

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

    return deposit.id;
  }
}
