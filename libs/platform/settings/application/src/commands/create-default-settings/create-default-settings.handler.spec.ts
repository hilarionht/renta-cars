import type { CompanySettings } from '@platform/settings/domain';

import type { SettingsRepository } from '../../ports/settings.repository';
import { CreateDefaultSettingsHandler } from './create-default-settings.handler';

describe('CreateDefaultSettingsHandler', () => {
  it('crea CompanySettings con defaults y lo persiste con el tx recibido, sin publicar nada', async () => {
    const savedSettings: CompanySettings[] = [];
    const settingsRepository: SettingsRepository = {
      findById: jest.fn(),
      save: jest.fn((settings: CompanySettings) => {
        savedSettings.push(settings);
        return Promise.resolve();
      }),
    };
    const handler = new CreateDefaultSettingsHandler(settingsRepository);
    const tx = {};

    await handler.execute({ companyId: 'company-a' }, tx);

    expect(settingsRepository.save).toHaveBeenCalledWith(expect.anything(), tx);
    expect(savedSettings).toHaveLength(1);
    expect(savedSettings[0].companyId).toBe('company-a');
    expect(savedSettings[0].enabledProductModules).toEqual(['Rental']);
  });
});
