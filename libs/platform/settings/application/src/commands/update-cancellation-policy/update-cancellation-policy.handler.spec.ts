import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { CompanySettings } from '@platform/settings/domain';

import type { SettingsRepository } from '../../ports/settings.repository';
import { UpdateCancellationPolicyHandler } from './update-cancellation-policy.handler';

function buildHandler(existingSettings: CompanySettings | null) {
  const settingsRepository: SettingsRepository = {
    findById: jest.fn().mockResolvedValue(existingSettings),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new UpdateCancellationPolicyHandler(
    settingsRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, settingsRepository, eventPublisher };
}

describe('UpdateCancellationPolicyHandler', () => {
  it('actualiza, persiste y publica CompanySettingsUpdated.v1', async () => {
    const settings = CompanySettings.create({ companyId: 'company-a' });
    const { handler, settingsRepository, eventPublisher } = buildHandler(settings);

    await handler.execute({
      companyId: 'company-a',
      tiers: [{ minHoursBeforeStart: 24, penaltyPercentage: 50 }],
    });

    expect(settings.cancellationPolicy.tiers).toEqual([
      { minHoursBeforeStart: 24, penaltyPercentage: 50 },
    ]);
    expect(settingsRepository.save).toHaveBeenCalledWith(settings, expect.anything());
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'CompanySettingsUpdated.v1',
        aggregateType: 'CompanySettings',
      }),
    );
  });

  it('lanza CompanySettingsNotFoundError si el repositorio no encuentra CompanySettings', async () => {
    const { handler, settingsRepository } = buildHandler(null);

    await expect(
      handler.execute({
        companyId: 'company-a',
        tiers: [{ minHoursBeforeStart: 0, penaltyPercentage: 0 }],
      }),
    ).rejects.toThrow();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });
});
