import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PaymentNotFoundError } from '@platform/payments/domain';

import { PaymentGatewayDeclinedError } from '../../errors/payment-gateway-declined.error';
import { PAYMENT_GATEWAY_PORT, type PaymentGatewayPort } from '../../ports/payment-gateway.port';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../../ports/payment.repository';
import type { AuthorizePaymentCommand } from './authorize-payment.command';

@Injectable()
export class AuthorizePaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly paymentGateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: AuthorizePaymentCommand): Promise<void> {
    const payment = await this.paymentRepository.findById(EntityId.from(command.paymentId));
    if (!payment || payment.companyId !== command.companyId) {
      throw new PaymentNotFoundError(command.paymentId);
    }

    let pendingDeclineError: PaymentGatewayDeclinedError | undefined;
    try {
      const result = await this.paymentGateway.authorize({
        idempotencyKey: payment.idempotencyKey,
        amount: { minorUnits: payment.amount.minorUnits, currency: payment.amount.currencyCode },
        method: payment.method.toString(),
        companyId: payment.companyId,
      });
      payment.authorize(result.gatewayReference);
    } catch (error) {
      if (!(error instanceof PaymentGatewayDeclinedError)) {
        throw error;
      }
      payment.fail(error.message);
      pendingDeclineError = error;
    }

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

    if (pendingDeclineError) {
      throw pendingDeclineError;
    }
  }
}
