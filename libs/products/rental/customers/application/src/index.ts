// Superficie publica de "rental-customers-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { CUSTOMER_REPOSITORY, type CustomerRepository } from './ports/customer.repository';
export {
  CUSTOMER_LOOKUP_PORT,
  type CustomerLookupPort,
  type CustomerContactInfo,
} from './ports/customer-lookup.port';
export {
  CUSTOMER_SESSION_REPOSITORY,
  type CustomerSessionRepository,
} from './ports/customer-session.repository';
export {
  CUSTOMER_REFRESH_TOKEN_HASHER,
  type CustomerRefreshTokenHasher,
} from './ports/customer-refresh-token-hasher.port';
export {
  CUSTOMER_OTP_CHALLENGE_REPOSITORY,
  type CustomerOtpChallengeRepository,
} from './ports/customer-otp-challenge.repository';
export {
  CUSTOMER_OTP_CODE_GENERATOR,
  type CustomerOtpCodeGenerator,
} from './ports/customer-otp-code-generator.port';

export { RegisterCustomerHandler } from './commands/register-customer/register-customer.handler';
export type { RegisterCustomerCommand } from './commands/register-customer/register-customer.command';
export { UpdateCustomerDetailsHandler } from './commands/update-customer-details/update-customer-details.handler';
export type { UpdateCustomerDetailsCommand } from './commands/update-customer-details/update-customer-details.command';
export { UploadIdentityDocumentHandler } from './commands/upload-identity-document/upload-identity-document.handler';
export type { UploadIdentityDocumentCommand } from './commands/upload-identity-document/upload-identity-document.command';
export { VerifyIdentityDocumentHandler } from './commands/verify-identity-document/verify-identity-document.handler';
export type { VerifyIdentityDocumentCommand } from './commands/verify-identity-document/verify-identity-document.command';
export { RegisterAdditionalDriverHandler } from './commands/register-additional-driver/register-additional-driver.handler';
export type { RegisterAdditionalDriverCommand } from './commands/register-additional-driver/register-additional-driver.command';
export { ValidateAdditionalDriverLicenseHandler } from './commands/validate-additional-driver-license/validate-additional-driver-license.handler';
export type { ValidateAdditionalDriverLicenseCommand } from './commands/validate-additional-driver-license/validate-additional-driver-license.command';
export { RevokeAdditionalDriverHandler } from './commands/revoke-additional-driver/revoke-additional-driver.handler';
export type { RevokeAdditionalDriverCommand } from './commands/revoke-additional-driver/revoke-additional-driver.command';
export { BlockCustomerHandler } from './commands/block-customer/block-customer.handler';
export type { BlockCustomerCommand } from './commands/block-customer/block-customer.command';
export { UnblockCustomerHandler } from './commands/unblock-customer/unblock-customer.handler';
export type { UnblockCustomerCommand } from './commands/unblock-customer/unblock-customer.command';
export { RefreshCustomerSessionHandler } from './commands/refresh-customer-session/refresh-customer-session.handler';
export type {
  RefreshCustomerSessionCommand,
  RefreshCustomerSessionResult,
} from './commands/refresh-customer-session/refresh-customer-session.command';
export { RevokeCustomerSessionHandler } from './commands/revoke-customer-session/revoke-customer-session.handler';
export type { RevokeCustomerSessionCommand } from './commands/revoke-customer-session/revoke-customer-session.command';
export { RequestCustomerOtpHandler } from './commands/request-customer-otp/request-customer-otp.handler';
export type { RequestCustomerOtpCommand } from './commands/request-customer-otp/request-customer-otp.command';
export { VerifyCustomerOtpHandler } from './commands/verify-customer-otp/verify-customer-otp.handler';
export type {
  VerifyCustomerOtpCommand,
  VerifyCustomerOtpResult,
} from './commands/verify-customer-otp/verify-customer-otp.command';

export type {
  GetCustomerQuery,
  CustomerDetail,
  IdentityDocumentSummary,
  AdditionalDriverSummary,
  ListCustomersQuery,
  CustomerSummary,
} from './queries/get-customer/get-customer.query';
