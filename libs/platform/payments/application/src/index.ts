// Superficie publica de "platform-payments-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { PAYMENT_REPOSITORY, type PaymentRepository } from './ports/payment.repository';
export {
  SECURITY_DEPOSIT_REPOSITORY,
  type SecurityDepositRepository,
} from './ports/security-deposit.repository';
export {
  PAYMENT_GATEWAY_PORT,
  type AmountInput,
  type AuthorizePaymentInput,
  type CapturePaymentInput,
  type RefundPaymentInput,
  type PaymentGatewayResult,
  type PaymentGatewayStatus,
  type PaymentGatewayPort,
} from './ports/payment-gateway.port';

export {
  STRIPE_WEBHOOK_TRANSLATOR_PORT,
  type StripeWebhookTranslatorPort,
} from './ports/stripe-webhook-translator.port';
export {
  MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
  type MercadoPagoWebhookBody,
  type MercadoPagoWebhookHeaders,
  type MercadoPagoWebhookTranslatorPort,
} from './ports/mercadopago-webhook-translator.port';

export { PaymentGatewayDeclinedError } from './errors/payment-gateway-declined.error';
export { PaymentGatewayUnavailableError } from './errors/payment-gateway-unavailable.error';

export { RequestPaymentHandler } from './commands/request-payment/request-payment.handler';
export type { RequestPaymentCommand } from './commands/request-payment/request-payment.command';
export { AuthorizePaymentHandler } from './commands/authorize-payment/authorize-payment.handler';
export type { AuthorizePaymentCommand } from './commands/authorize-payment/authorize-payment.command';
export { CapturePaymentHandler } from './commands/capture-payment/capture-payment.handler';
export type { CapturePaymentCommand } from './commands/capture-payment/capture-payment.command';
export { RefundPaymentHandler } from './commands/refund-payment/refund-payment.handler';
export type { RefundPaymentCommand } from './commands/refund-payment/refund-payment.command';
export { HoldSecurityDepositHandler } from './commands/hold-security-deposit/hold-security-deposit.handler';
export type { HoldSecurityDepositCommand } from './commands/hold-security-deposit/hold-security-deposit.command';
export { ReleaseSecurityDepositHandler } from './commands/release-security-deposit/release-security-deposit.handler';
export type { ReleaseSecurityDepositCommand } from './commands/release-security-deposit/release-security-deposit.command';
export { RetainSecurityDepositHandler } from './commands/retain-security-deposit/retain-security-deposit.handler';
export type { RetainSecurityDepositCommand } from './commands/retain-security-deposit/retain-security-deposit.command';
export { HandleGatewayWebhookHandler } from './commands/handle-gateway-webhook/handle-gateway-webhook.handler';
export type { HandleGatewayWebhookCommand } from './commands/handle-gateway-webhook/handle-gateway-webhook.command';

export type { GetPaymentQuery, PaymentSummary } from './queries/get-payment/get-payment.query';
export type {
  ListPaymentsQuery,
  ListPaymentsResult,
} from './queries/list-payments/list-payments.query';
export type {
  GetSecurityDepositQuery,
  SecurityDepositSummary,
} from './queries/get-security-deposit/get-security-deposit.query';
export type {
  ListSecurityDepositsQuery,
  ListSecurityDepositsResult,
} from './queries/list-security-deposits/list-security-deposits.query';
