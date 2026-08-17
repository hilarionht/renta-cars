// Superficie publica de "platform-settings-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { SETTINGS_REPOSITORY, type SettingsRepository } from './ports/settings.repository';
export { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from './ports/settings-lookup.port';
export { CreateDefaultSettingsHandler } from './commands/create-default-settings/create-default-settings.handler';
export { UpdateEnabledProductModulesHandler } from './commands/update-enabled-product-modules/update-enabled-product-modules.handler';
export type { UpdateEnabledProductModulesCommand } from './commands/update-enabled-product-modules/update-enabled-product-modules.command';
export { UpdatePaymentMethodsEnabledHandler } from './commands/update-payment-methods-enabled/update-payment-methods-enabled.handler';
export type { UpdatePaymentMethodsEnabledCommand } from './commands/update-payment-methods-enabled/update-payment-methods-enabled.command';
export type {
  GetCompanySettingsQuery,
  CompanySettingsSummary,
} from './queries/get-company-settings/get-company-settings.query';
