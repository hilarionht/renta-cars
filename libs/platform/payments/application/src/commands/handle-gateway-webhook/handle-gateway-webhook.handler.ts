import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PaymentNotFoundError } from '@platform/payments/domain';

import { PAYMENT_REPOSITORY, type PaymentRepository } from '../../ports/payment.repository';
import type { HandleGatewayWebhookCommand } from './handle-gateway-webhook.command';

// Idempotente por estado destino (mismo criterio que el bug #56 de Fase 1, confirm() sobre
// una Reservation ya Confirmed): si el Payment ya esta en el estado que la notificacion
// reporta, no-op silencioso - una reentrega del proveedor nunca vuelve a emitir el evento de
// dominio ni a bumpear version.
@Injectable()
export class HandleGatewayWebhookHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: HandleGatewayWebhookCommand): Promise<void> {
    const payment = await this.paymentRepository.findByGatewayReference(command.gatewayReference);
    if (!payment) {
      throw new PaymentNotFoundError(command.gatewayReference);
    }

    if (command.result === 'captured') {
      if (payment.status === 'Captured') {
        return;
      }
      payment.capture(command.gatewayReference);
    } else if (command.result === 'failed') {
      if (payment.status === 'Failed') {
        return;
      }
      payment.fail(command.reason ?? 'Rechazado por la pasarela');
    } else {
      if (payment.status === 'Refunded') {
        return;
      }
      payment.refund();
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
  }
}
