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
import type { CapturePaymentCommand } from './capture-payment.command';

// RN-24: metodos con preautorizacion (Card, DigitalWallet) capturan contra la pasarela;
// Cash/Transfer son "registro manual" y transicionan directo, sin tocar el gateway
// (docs/model/08-STATE_MACHINES.md SS3.1).
@Injectable()
export class CapturePaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly paymentGateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CapturePaymentCommand): Promise<void> {
    const payment = await this.paymentRepository.findById(EntityId.from(command.paymentId));
    if (!payment || payment.companyId !== command.companyId) {
      throw new PaymentNotFoundError(command.paymentId);
    }

    let pendingDeclineError: PaymentGatewayDeclinedError | undefined;
    if (payment.method.requiresPreAuthorization()) {
      try {
        const result = await this.paymentGateway.capture({
          gatewayReference: payment.gatewayReference,
          amount: { minorUnits: payment.amount.minorUnits, currency: payment.amount.currencyCode },
        });
        payment.capture(result.gatewayReference);
      } catch (error) {
        if (!(error instanceof PaymentGatewayDeclinedError)) {
          throw error;
        }
        payment.fail(error.message);
        pendingDeclineError = error;
      }
    } else {
      payment.capture();
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
