import type { HandleGatewayWebhookCommand } from '../commands/handle-gateway-webhook/handle-gateway-webhook.command';

// Puerto de I/O externo, mismo criterio que PAYMENT_GATEWAY_PORT - implementado por
// StripePaymentGatewayAdapter (platform-integration-providers-infrastructure), que es detalle
// interno de esa libreria (solo IntegrationProvidersModule es publico, docs/technical/
// 09-CODING-STANDARDS.md SS2) - StripeWebhookController (payments/infrastructure) nunca
// importa el adaptador concreto, solo este puerto.
export const STRIPE_WEBHOOK_TRANSLATOR_PORT = Symbol('StripeWebhookTranslatorPort');

export interface StripeWebhookTranslatorPort {
  // Verifica la firma nativa del SDK (stripe.webhooks.constructEvent) y traduce a un comando
  // de dominio - null si el tipo de evento no es relevante para Payment (el controller
  // responde 200 sin invocar HandleGatewayWebhookHandler). Lanza UnauthorizedException si la
  // firma es invalida (docs/contracts/06-WEBHOOKS.md).
  verifyAndTranslateWebhook(
    rawBody: Buffer,
    signatureHeader: string,
  ): HandleGatewayWebhookCommand | null;
}
