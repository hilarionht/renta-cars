import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { CompanySettings } from '@platform/settings/domain';

export const SETTINGS_REPOSITORY = Symbol('SettingsRepository');

export interface SettingsRepository {
  findById(companyId: string): Promise<CompanySettings | null>;
  save(settings: CompanySettings, tx: UnitOfWorkTransaction): Promise<void>;
}
