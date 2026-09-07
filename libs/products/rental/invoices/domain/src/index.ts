// Superficie publica de "rental-invoices-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Invoice, type InvoiceId, type InvoiceProps } from './entities/invoice';
export { Charge, type ChargeId, type ChargeProps } from './entities/charge';

export { InvoiceNumber } from './value-objects/invoice-number';
export type { InvoiceStatusValue } from './value-objects/invoice-status';
export { CHARGE_KINDS, type ChargeKindValue } from './value-objects/charge-kind';
export { TaxDetails } from './value-objects/tax-details';

export { InvoiceNotFoundError } from './errors/invoice-not-found.error';
export { InvoiceInvalidStateTransitionError } from './errors/invoice-invalid-state-transition.error';
export { InvoiceAlreadyIssuedError } from './errors/invoice-already-issued.error';

export type { InvoiceIssuedEvent, InvoiceIssuedChargePayload } from './events/invoice-issued.event';
export type { InvoiceVoidedEvent } from './events/invoice-voided.event';
