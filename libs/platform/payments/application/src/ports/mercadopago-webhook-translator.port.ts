import type { HandleGatewayWebhookCommand } from '../commands/handle-gateway-webhook/handle-gateway-webhook.command';

// Puerto de I/O externo, mismo criterio que STRIPE_WEBHOOK_TRANSLATOR_PORT - implementado por
// MercadoPagoPaymentGatewayAdapter (platform-integration-providers-infrastructure), detalle
// interno de esa libreria.
export const MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT = Symbol('MercadoPagoWebhookTranslatorPort');

export interface MercadoPagoWebhookBody {
  data?: { id?: string };
}

// Formas sueltas (string | string[] | undefined | null) - mismo shape que Express expone para
// headers/query, y que WebhookSignatureValidator.validate() de la SDK ya normaliza
// internamente (no es un tipo especifico de Mercado Pago).
export interface MercadoPagoWebhookHeaders {
  xSignature: string | string[] | undefined | null;
  xRequestId: string | string[] | undefined | null;
  dataId: string | string[] | undefined | null;
}

export interface MercadoPagoWebhookTranslatorPort {
  // Verifica la firma nativa del SDK (WebhookSignatureValidator.validate) y traduce a un
  // comando de dominio - null si data.id falta o el status del payment no es un desenlace
  // final (pending). Lanza UnauthorizedException si la firma es invalida
  // (docs/contracts/06-WEBHOOKS.md).
  verifyAndTranslateWebhook(
    body: MercadoPagoWebhookBody,
    headers: MercadoPagoWebhookHeaders,
  ): Promise<HandleGatewayWebhookCommand | null>;
}
