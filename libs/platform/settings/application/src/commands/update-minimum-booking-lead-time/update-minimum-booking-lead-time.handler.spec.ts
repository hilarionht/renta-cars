import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { CompanySettings } from '@platform/settings/domain';

import type { SettingsRepository } from '../../ports/settings.repository';
import { UpdateMinimumBookingLeadTimeHandler } from './update-minimum-booking-lead-time.handler';

function buildHandler(existingSettings: CompanySettings | null) {
  const settingsRepository: SettingsRepository = {
    findById: jest.fn().mockResolvedValue(existingSettings),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new UpdateMinimumBookingLeadTimeHandler(
    settingsRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, settingsRepository, eventPublisher };
}

describe('UpdateMinimumBookingLeadTimeHandler', () => {
  it('actualiza, persiste y publica CompanySettingsUpdated.v1', async () => {
    const settings = CompanySettings.create({ companyId: 'company-a' });
    const { handler, settingsRepository, eventPublisher } = buildHandler(settings);

    await handler.execute({ companyId: 'company-a', leadTimeMinutes: 30 });

    expect(settings.minimumBookingLeadTime.leadTimeMinutes).toBe(30);
    expect(settingsRepository.save).toHaveBeenCalledWith(settings, expect.anything());
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('lanza CompanySettingsNotFoundError si el repositorio no encuentra CompanySettings', async () => {
    const { handler, settingsRepository } = buildHandler(null);

    await expect(
      handler.execute({ companyId: 'company-a', leadTimeMinutes: 30 }),
    ).rejects.toThrow();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });
});
