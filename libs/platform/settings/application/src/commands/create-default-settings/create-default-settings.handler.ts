import { Inject, Injectable } from '@nestjs/common';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { CompanySettings } from '@platform/settings/domain';

import { SETTINGS_REPOSITORY, type SettingsRepository } from '../../ports/settings.repository';

// Invocado exclusivamente por RegisterCompanyHandler (platform-companies-application), nunca
// via HTTP - companies/application no puede importar settings/domain directamente
// (tooling/eslint/boundaries.mjs, eje de modulo: type:domain solo depende de si mismo/
// scope:shared), asi que este handler vive en settings/application (mismo modulo que
// CompanySettings) y RegisterCompanyHandler lo llama pasandole el mismo `tx` ya abierto por
// su propio UnitOfWork.run() - docs/persistence/07-MIGRACIONES.md SS5.2: "siempre inserta
// ambas filas (companies + company_settings) en la misma transaccion". Sin publish: create()
// no emite ningun evento propio (ver CompanySettings.create()).
@Injectable()
export class CreateDefaultSettingsHandler {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settingsRepository: SettingsRepository,
  ) {}

  async execute(params: { companyId: string }, tx: UnitOfWorkTransaction): Promise<void> {
    const settings = CompanySettings.create({ companyId: params.companyId });
    await this.settingsRepository.save(settings, tx);
  }
}
