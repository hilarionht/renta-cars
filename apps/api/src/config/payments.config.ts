import { registerAs } from '@nestjs/config';

const DEFAULT_GATEWAY_PROVIDER = 'fake';

// Namespace "payments" (PaymentGatewayPort, docs/11-INTEGRACIONES.md SS6). El adaptador
// activo se selecciona por config, nunca hardcodeado (ADR-0010) - "fake" es el default de
// desarrollo/test; Stripe/MercadoPago requieren credenciales reales que este entorno no tiene
// (docs/persistence/10-DECISIONES.md Fase 2, decision de alcance explicita del usuario).
export default registerAs('payments', () => ({
  gatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER ?? DEFAULT_GATEWAY_PROVIDER,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  mercadopago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  },
}));
