// Superficie publica de "platform-settings-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export {
  SETTINGS_LOOKUP_PORT,
  type SettingsLookupPort,
  type CancellationPolicyView,
  type LateReturnPolicyView,
  type DepositPolicyView,
  type MaintenanceThresholdPolicyView,
} from './ports/settings-lookup.port';
export { SETTINGS_REPOSITORY, type SettingsRepository } from './ports/settings.repository';
export { CreateDefaultSettingsHandler } from './commands/create-default-settings/create-default-settings.handler';
export { UpdateEnabledProductModulesHandler } from './commands/update-enabled-product-modules/update-enabled-product-modules.handler';
export type { UpdateEnabledProductModulesCommand } from './commands/update-enabled-product-modules/update-enabled-product-modules.command';
export { UpdatePaymentMethodsEnabledHandler } from './commands/update-payment-methods-enabled/update-payment-methods-enabled.handler';
export type { UpdatePaymentMethodsEnabledCommand } from './commands/update-payment-methods-enabled/update-payment-methods-enabled.command';
export { UpdateCancellationPolicyHandler } from './commands/update-cancellation-policy/update-cancellation-policy.handler';
export type { UpdateCancellationPolicyCommand } from './commands/update-cancellation-policy/update-cancellation-policy.command';
export { UpdateLateReturnPolicyHandler } from './commands/update-late-return-policy/update-late-return-policy.handler';
export type { UpdateLateReturnPolicyCommand } from './commands/update-late-return-policy/update-late-return-policy.command';
export { UpdateDepositPolicyHandler } from './commands/update-deposit-policy/update-deposit-policy.handler';
export type { UpdateDepositPolicyCommand } from './commands/update-deposit-policy/update-deposit-policy.command';
export { UpdateDraftExpirationPolicyHandler } from './commands/update-draft-expiration-policy/update-draft-expiration-policy.handler';
export type { UpdateDraftExpirationPolicyCommand } from './commands/update-draft-expiration-policy/update-draft-expiration-policy.command';
export { UpdateMinimumBookingLeadTimeHandler } from './commands/update-minimum-booking-lead-time/update-minimum-booking-lead-time.handler';
export type { UpdateMinimumBookingLeadTimeCommand } from './commands/update-minimum-booking-lead-time/update-minimum-booking-lead-time.command';
export { UpdateReminderLeadTimeHandler } from './commands/update-reminder-lead-time/update-reminder-lead-time.handler';
export type { UpdateReminderLeadTimeCommand } from './commands/update-reminder-lead-time/update-reminder-lead-time.command';
export { UpdateNotificationChannelPreferenceHandler } from './commands/update-notification-channel-preference/update-notification-channel-preference.handler';
export type { UpdateNotificationChannelPreferenceCommand } from './commands/update-notification-channel-preference/update-notification-channel-preference.command';
export { UpdateMaintenanceThresholdPolicyHandler } from './commands/update-maintenance-threshold-policy/update-maintenance-threshold-policy.handler';
export type { UpdateMaintenanceThresholdPolicyCommand } from './commands/update-maintenance-threshold-policy/update-maintenance-threshold-policy.command';
export type {
  GetCompanySettingsQuery,
  CompanySettingsSummary,
} from './queries/get-company-settings/get-company-settings.query';
