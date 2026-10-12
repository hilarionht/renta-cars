// Superficie publica de "platform-payments-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Payment, type PaymentId, type PaymentProps } from './entities/payment';
export {
  SecurityDeposit,
  type SecurityDepositId,
  type SecurityDepositProps,
} from './entities/security-deposit';

export {
  PaymentMethod,
  PAYMENT_METHODS,
  type PaymentMethodValue,
} from './value-objects/payment-method';
export type { PaymentStatusValue } from './value-objects/payment-status';
export type { DepositStatusValue } from './value-objects/deposit-status';
export type { PaymentTargetTypeValue } from './value-objects/payment-target';
export { IdempotencyKey } from './value-objects/idempotency-key';

export { InvalidPaymentMethodError } from './errors/invalid-payment-method.error';
export { PaymentNotFoundError } from './errors/payment-not-found.error';
export { PaymentInvalidStateTransitionError } from './errors/payment-invalid-state-transition.error';
export { PaymentAlreadyProcessedError } from './errors/payment-already-processed.error';
export { SecurityDepositNotFoundError } from './errors/security-deposit-not-found.error';
export { SecurityDepositAlreadyResolvedError } from './errors/security-deposit-already-resolved.error';
export { DepositRetentionExceedsHeldError } from './errors/deposit-retention-exceeds-held.error';

export type { PaymentSucceededEvent } from './events/payment-succeeded.event';
export type { PaymentFailedEvent } from './events/payment-failed.event';
export type { PaymentRefundedEvent } from './events/payment-refunded.event';
export type { SecurityDepositHeldEvent } from './events/security-deposit-held.event';
export type { SecurityDepositReleasedEvent } from './events/security-deposit-released.event';
export type { SecurityDepositPartiallyRetainedEvent } from './events/security-deposit-partially-retained.event';
