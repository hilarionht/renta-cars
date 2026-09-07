// Puerto de I/O externo (docs/ADR/0010-provider-pattern-integraciones.md,
// docs/11-INTEGRACIONES.md SS6) - definido junto al modulo consumidor (payments),
// implementado en platform-integration-providers-infrastructure (Fake/Stripe/MercadoPago
// PaymentGatewayAdapter). Ningun modulo de dominio conoce el SDK/proveedor concreto. 4
// metodos exactos del contrato - authorize/capture/refund/getStatus.
export const PAYMENT_GATEWAY_PORT = Symbol('PaymentGatewayPort');

export interface AmountInput {
  minorUnits: number;
  currency: string;
}

export interface AuthorizePaymentInput {
  idempotencyKey: string;
  amount: AmountInput;
  method: string;
  // Adjuntado como metadata en la pasarela (Stripe PaymentIntent.metadata,
  // MercadoPago Payment.metadata) - unica forma de que HandleGatewayWebhookHandler
  // resuelva el tenant de un Payment cuando una notificacion de webhook llega sin
  // RequestContext (ruta @Public(), RLS fail-closed exige un company_id explicito -
  // docs/persistence/06-RLS.md SS6).
  companyId: string;
}

export interface CapturePaymentInput {
  gatewayReference?: string;
  amount: AmountInput;
}

export interface RefundPaymentInput {
  gatewayReference: string;
  amount: AmountInput;
}

export interface PaymentGatewayResult {
  gatewayReference: string;
}

export type PaymentGatewayStatus = 'succeeded' | 'failed' | 'pending';

export interface PaymentGatewayPort {
  authorize(input: AuthorizePaymentInput): Promise<PaymentGatewayResult>;
  capture(input: CapturePaymentInput): Promise<PaymentGatewayResult>;
  refund(input: RefundPaymentInput): Promise<PaymentGatewayResult>;
  getStatus(gatewayReference: string): Promise<PaymentGatewayStatus>;
}
