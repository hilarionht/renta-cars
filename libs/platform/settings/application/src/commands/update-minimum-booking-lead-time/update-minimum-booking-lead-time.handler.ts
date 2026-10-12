import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { CompanySettingsNotFoundError, MinimumBookingLeadTime } from '@platform/settings/domain';

import { SETTINGS_REPOSITORY, type SettingsRepository } from '../../ports/settings.repository';
import type { UpdateMinimumBookingLeadTimeCommand } from './update-minimum-booking-lead-time.command';

@Injectable()
export class UpdateMinimumBookingLeadTimeHandler {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settingsRepository: SettingsRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdateMinimumBookingLeadTimeCommand): Promise<void> {
    const settings = await this.settingsRepository.findById(command.companyId);
    if (!settings) {
      throw new CompanySettingsNotFoundError(command.companyId);
    }

    settings.updateMinimumBookingLeadTime(MinimumBookingLeadTime.from(command.leadTimeMinutes));

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
