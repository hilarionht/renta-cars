import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { CompanySettings } from '@platform/settings/domain';

import type { SettingsRepository } from '../../ports/settings.repository';
import { UpdateDraftExpirationPolicyHandler } from './update-draft-expiration-policy.handler';

function buildHandler(existingSettings: CompanySettings | null) {
  const settingsRepository: SettingsRepository = {
    findById: jest.fn().mockResolvedValue(existingSettings),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new UpdateDraftExpirationPolicyHandler(
    settingsRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, settingsRepository, eventPublisher };
}

describe('UpdateDraftExpirationPolicyHandler', () => {
  it('actualiza, persiste y publica CompanySettingsUpdated.v1', async () => {
    const settings = CompanySettings.create({ companyId: 'company-a' });
    const { handler, settingsRepository, eventPublisher } = buildHandler(settings);

    await handler.execute({ companyId: 'company-a', expirationMinutes: 60 });

    expect(settings.draftExpirationPolicy.expirationMinutes).toBe(60);
    expect(settingsRepository.save).toHaveBeenCalledWith(settings, expect.anything());
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('lanza CompanySettingsNotFoundError si el repositorio no encuentra CompanySettings', async () => {
    const { handler, settingsRepository } = buildHandler(null);

    await expect(
      handler.execute({ companyId: 'company-a', expirationMinutes: 60 }),
    ).rejects.toThrow();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });
});
