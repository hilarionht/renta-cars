import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { CompanySettingsNotFoundError, PaymentMethod } from '@platform/settings/domain';

import { SETTINGS_REPOSITORY, type SettingsRepository } from '../../ports/settings.repository';
import type { UpdatePaymentMethodsEnabledCommand } from './update-payment-methods-enabled.command';

@Injectable()
export class UpdatePaymentMethodsEnabledHandler {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settingsRepository: SettingsRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdatePaymentMethodsEnabledCommand): Promise<void> {
    const settings = await this.settingsRepository.findById(command.companyId);
    if (!settings) {
      throw new CompanySettingsNotFoundError(command.companyId);
    }

    // PaymentMethod.from() valida cada valor contra el catalogo cerrado ANTES de tocar el
    // agregado - PaymentMethodsEmptyError (arreglo vacio) se valida despues, dentro de
    // updatePaymentMethods().
    const methods = command.paymentMethods.map((value) => PaymentMethod.from(value));
    settings.updatePaymentMethods(methods);

    await this.unitOfWork.run(async (tx) => {
      await this.settingsRepository.save(settings, tx);
      for (const event of settings.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'CompanySettings',
          aggregateId: settings.companyId,
          companyId: settings.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
