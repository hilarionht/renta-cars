// Superficie publica de "rental-customers-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Customer, type CustomerId, type CustomerProps } from './entities/customer';
export {
  IdentityDocument,
  type IdentityDocumentId,
  type IdentityDocumentProps,
  type IdentityDocumentOwner,
} from './entities/identity-document';
export {
  AdditionalDriver,
  type AdditionalDriverId,
  type AdditionalDriverProps,
} from './entities/additional-driver';
export { CustomerName } from './value-objects/customer-name';
export { TaxIdOrDocumentId } from './value-objects/tax-id-or-document-id';
export { ContactInfo } from './value-objects/contact-info';
export type { CustomerType } from './value-objects/customer-type';
export type { CustomerStatus } from './value-objects/customer-status';
export type { CustomerBlockStatusValue } from './value-objects/customer-block-status';
export type { DocumentType } from './value-objects/document-type';
export type { IdentityDocumentStatus } from './value-objects/identity-document-status';
export type { AdditionalDriverStatus } from './value-objects/additional-driver-status';
export { CustomerNotFoundError } from './errors/customer-not-found.error';
export { IdentityDocumentNotFoundError } from './errors/identity-document-not-found.error';
export { AdditionalDriverNotFoundError } from './errors/additional-driver-not-found.error';
export { IdentityDocumentExpiredError } from './errors/identity-document-expired.error';
export { AdditionalDriverRevokedError } from './errors/additional-driver-revoked.error';
export { AdditionalDriverMissingValidLicenseError } from './errors/additional-driver-missing-valid-license.error';
export { DuplicateActiveIdentityDocumentError } from './errors/duplicate-active-identity-document.error';
export type { CustomerRegisteredEvent } from './events/customer-registered.event';
export type { CustomerDocumentValidatedEvent } from './events/customer-document-validated.event';
export type { CustomerDocumentExpiredEvent } from './events/customer-document-expired.event';
export type { AdditionalDriverRegisteredEvent } from './events/additional-driver-registered.event';
export type { AdditionalDriverValidatedEvent } from './events/additional-driver-validated.event';
export type { AdditionalDriverRevokedEvent } from './events/additional-driver-revoked.event';
export type { CustomerBlockedEvent } from './events/customer-blocked.event';
export type { CustomerUnblockedEvent } from './events/customer-unblocked.event';
export {
  CustomerSession,
  type CustomerSessionId,
  type CustomerSessionProps,
} from './entities/customer-session';
export { CustomerDeviceContext } from './value-objects/customer-device-context';
export { CustomerRefreshTokenHash } from './value-objects/customer-refresh-token-hash';
export type { CustomerSessionStatus } from './value-objects/customer-session-status';
export {
  CustomerSessionSecurityService,
  type CustomerRotateParams,
  type CustomerRotateOutcome,
} from './services/customer-session-security.service';
export type { CustomerSessionCreatedEvent } from './events/customer-session-created.event';
export type { CustomerSessionRevokedEvent } from './events/customer-session-revoked.event';
export { InvalidCustomerRefreshTokenError } from './errors/invalid-customer-refresh-token.error';
export { CustomerRefreshTokenReusedError } from './errors/customer-refresh-token-reused.error';
export {
  CustomerOtpChallenge,
  type CustomerOtpChallengeId,
  type CustomerOtpChallengeProps,
  type CustomerOtpVerificationOutcome,
} from './entities/customer-otp-challenge';
export { CustomerOtpCodeHash } from './value-objects/customer-otp-code-hash';
export type { CustomerOtpChallengeStatus } from './value-objects/customer-otp-challenge-status';
export { OtpChallengeNotFoundError } from './errors/otp-challenge-not-found.error';
export { InvalidCustomerOtpCodeError } from './errors/invalid-customer-otp-code.error';
