import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PaymentNotFoundError } from '@platform/payments/domain';

import { PAYMENT_GATEWAY_PORT, type PaymentGatewayPort } from '../../ports/payment-gateway.port';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../../ports/payment.repository';
import type { RefundPaymentCommand } from './refund-payment.command';

// Sin manejo especial de rechazo del gateway (a diferencia de authorize/capture): Payment no
// tiene un estado "RefundFailed" en el catalogo (docs/model/08-STATE_MACHINES.md SS3) - si el
// gateway falla, el error se propaga sin tocar el aggregate y Payment permanece Captured para
// reintento.
@Injectable()
export class RefundPaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly paymentGateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RefundPaymentCommand): Promise<void> {
    const payment = await this.paymentRepository.findById(EntityId.from(command.paymentId));
    if (!payment || payment.companyId !== command.companyId) {
      throw new PaymentNotFoundError(command.paymentId);
    }

    if (payment.method.requiresPreAuthorization() && payment.gatewayReference) {
      await this.paymentGateway.refund({
        gatewayReference: payment.gatewayReference,
        amount: { minorUnits: payment.amount.minorUnits, currency: payment.amount.currencyCode },
      });
    }
    payment.refund();

    await this.unitOfWork.run(async (tx) => {
      await this.paymentRepository.save(payment, tx);
      for (const event of payment.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Payment',
          aggregateId: payment.id.toString(),
          companyId: payment.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
