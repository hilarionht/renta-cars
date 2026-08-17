// Superficie publica de "platform-settings-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { CompanySettings, type CompanySettingsProps } from './entities/company-settings';
export {
  PaymentMethod,
  PAYMENT_METHODS,
  type PaymentMethodValue,
} from './value-objects/payment-method';
export { EnabledProductModulesEmptyError } from './errors/enabled-product-modules-empty.error';
export { PaymentMethodsEmptyError } from './errors/payment-methods-empty.error';
export { InvalidPaymentMethodError } from './errors/invalid-payment-method.error';
export { CompanySettingsNotFoundError } from './errors/company-settings-not-found.error';
export type { CompanySettingsUpdatedEvent } from './events/company-settings-updated.event';
