// Superficie publica de "platform-companies-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Company, type CompanyId, type CompanyProps } from './entities/company';
export { LegalName } from './value-objects/legal-name';
export { TaxId } from './value-objects/tax-id';
export { BillingContact } from './value-objects/billing-contact';
export type { CompanyStatus } from './value-objects/company-status';
export { DuplicateTaxIdError } from './errors/duplicate-tax-id.error';
export { CompanyNotFoundError } from './errors/company-not-found.error';
export type { CompanyRegisteredEvent } from './events/company-registered.event';
export type { CompanySuspendedEvent } from './events/company-suspended.event';
