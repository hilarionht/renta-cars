import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  CapturePaymentInput,
  PaymentGatewayPort,
  PaymentGatewayResult,
  PaymentGatewayStatus,
  RefundPaymentInput,
} from '@platform/payments/application';

// docs/persistence/10-DECISIONES.md (Fase 2) - unico adaptador ejercido end-to-end en el
// smoke test de esta tanda (sin credenciales reales de Stripe/Mercado Pago en este entorno).
// Determinista, siempre exitoso, sin latencia simulada.
@Injectable()
export class FakePaymentGatewayAdapter implements PaymentGatewayPort {
  authorize(): Promise<PaymentGatewayResult> {
    return Promise.resolve({ gatewayReference: `fake_${randomUUID()}` });
  }

  capture(input: CapturePaymentInput): Promise<PaymentGatewayResult> {
    return Promise.resolve({ gatewayReference: input.gatewayReference ?? `fake_${randomUUID()}` });
  }

  refund(input: RefundPaymentInput): Promise<PaymentGatewayResult> {
    return Promise.resolve({ gatewayReference: input.gatewayReference });
  }

  getStatus(): Promise<PaymentGatewayStatus> {
    return Promise.resolve('succeeded');
  }
}
