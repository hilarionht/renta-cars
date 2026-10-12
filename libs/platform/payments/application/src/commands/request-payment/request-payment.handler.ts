import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';
import {
  InvalidPaymentMethodError,
  Payment,
  type PaymentId,
  PaymentMethod,
} from '@platform/payments/domain';

import { PAYMENT_REPOSITORY, type PaymentRepository } from '../../ports/payment.repository';
import type { RequestPaymentCommand } from './request-payment.command';

// docs/model/04-VALUE_OBJECTS.md SS6: "PaymentMethod debe pertenecer al PaymentMethodsEnabled
// vigente de la Company" - sin codigo de error dedicado en el catalogo para este segundo punto
// de validacion (INVALID_PAYMENT_METHOD esta documentado especificamente para el endpoint de
// company-settings, docs/contracts/07-ERROR-CATALOG.md) - se reutiliza la misma clase de
// error, mismo criterio de reuso ya aplicado en esta tanda a SecurityDepositPartiallyRetained.v1.
@Injectable()
export class RequestPaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookupPort: SettingsLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RequestPaymentCommand): Promise<PaymentId> {
    const method = PaymentMethod.from(command.method);
    const enabledMethods = await this.settingsLookupPort.getPaymentMethodsEnabled(
      command.companyId,
    );
    if (enabledMethods && !enabledMethods.includes(command.method)) {
      throw new InvalidPaymentMethodError(command.method);
    }

    const payment = Payment.request({
      companyId: command.companyId,
      targetType: command.targetType,
      targetId: command.targetId,
      amount: Money.from(command.amountMinorUnits, command.currency),
      method,
      idempotencyKey: command.idempotencyKey,
    });

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

    return payment.id;
  }
}
