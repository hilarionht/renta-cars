import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type {
  AuthorizePaymentInput,
  CapturePaymentInput,
  HandleGatewayWebhookCommand,
  PaymentGatewayPort,
  PaymentGatewayResult,
  PaymentGatewayStatus,
  RefundPaymentInput,
  StripeWebhookTranslatorPort,
} from '@platform/payments/application';
import {
  PaymentGatewayDeclinedError,
  PaymentGatewayUnavailableError,
} from '@platform/payments/application';

interface StripeGatewayConfig {
  secretKey: string;
  webhookSecret: string;
}

// docs/11-INTEGRACIONES.md SS6 - SDK oficial "stripe" real. Sin credenciales reales de Stripe
// disponibles en este entorno de desarrollo (decision de alcance explicita del usuario,
// docs/persistence/10-DECISIONES.md Fase 2): codigo completo y listo, pero NO ejercido contra
// la API viva en el smoke test de esta tanda (ese rol lo cumple FakePaymentGatewayAdapter,
// seleccionado por PAYMENT_GATEWAY_PROVIDER=fake).
@Injectable()
export class StripePaymentGatewayAdapter
  implements PaymentGatewayPort, StripeWebhookTranslatorPort
{
  private readonly stripeConfig: StripeGatewayConfig;
  private lazyClient?: Stripe;

  constructor(configService: ConfigService) {
    // El SDK de Stripe lanza en su propio constructor si apiKey es vacio/undefined - este
    // adaptador se instancia siempre (STRIPE_WEBHOOK_TRANSLATOR_PORT lo referencia via
    // useExisting, Nest lo resuelve de forma eager sin importar que PAYMENT_GATEWAY_PROVIDER
    // este activo), asi que construir `Stripe` aca abajo tumbaria el boot completo de la app
    // en cualquier entorno sin STRIPE_SECRET_KEY real (el caso de desarrollo por defecto,
    // docs/persistence/10-DECISIONES.md Fase 2). Se difiere la construccion a `client`.
    this.stripeConfig = configService.getOrThrow<StripeGatewayConfig>('payments.stripe');
  }

  private get client(): Stripe {
    if (!this.stripeConfig.secretKey) {
      throw new PaymentGatewayUnavailableError('stripe', 'STRIPE_SECRET_KEY no esta configurada.');
    }
    if (!this.lazyClient) {
      this.lazyClient = new Stripe(this.stripeConfig.secretKey);
    }
    return this.lazyClient;
  }

  private get webhookSecret(): string {
    return this.stripeConfig.webhookSecret;
  }

  async authorize(input: AuthorizePaymentInput): Promise<PaymentGatewayResult> {
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: input.amount.minorUnits,
          currency: input.amount.currency.toLowerCase(),
          capture_method: 'manual',
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          // Unica forma de que verifyAndTranslateWebhook() resuelva el tenant de un webhook
          // entrante sin RequestContext (ruta @Public(), RLS fail-closed).
          metadata: { companyId: input.companyId },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { gatewayReference: intent.id };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async capture(input: CapturePaymentInput): Promise<PaymentGatewayResult> {
    if (!input.gatewayReference) {
      throw new PaymentGatewayUnavailableError(
        'stripe',
        'capture() sin gatewayReference (PaymentIntent) previo',
      );
    }
    try {
      const intent = await this.client.paymentIntents.capture(input.gatewayReference);
      return { gatewayReference: intent.id };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async refund(input: RefundPaymentInput): Promise<PaymentGatewayResult> {
    try {
      const refund = await this.client.refunds.create({ payment_intent: input.gatewayReference });
      return { gatewayReference: refund.id };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async getStatus(gatewayReference: string): Promise<PaymentGatewayStatus> {
    const intent = await this.client.paymentIntents.retrieve(gatewayReference);
    if (intent.status === 'succeeded') {
      return 'succeeded';
    }
    if (intent.status === 'canceled') {
      return 'failed';
    }
    return 'pending';
  }

  // docs/contracts/06-WEBHOOKS.md - verificacion de firma nativa del SDK
  // (stripe.webhooks.constructEvent). Retorna null para tipos de evento irrelevantes para
  // Payment (el controller responde 200 sin invocar HandleGatewayWebhookHandler) - Stripe
  // reintenta solo ante fallas de red/5xx, nunca ante "200 sin traducir".
  verifyAndTranslateWebhook(
    rawBody: Buffer,
    signatureHeader: string,
  ): HandleGatewayWebhookCommand | null {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
    } catch (error) {
      throw new UnauthorizedException(
        `Firma de webhook de Stripe invalida: ${(error as Error).message}`,
      );
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    if (event.type === 'payment_intent.succeeded') {
      const companyId = intent.metadata?.companyId;
      if (!companyId) {
        return null;
      }
      return { companyId, gatewayReference: intent.id, result: 'captured' };
    }
    if (event.type === 'payment_intent.payment_failed') {
      const companyId = intent.metadata?.companyId;
      if (!companyId) {
        return null;
      }
      return {
        companyId,
        gatewayReference: intent.id,
        result: 'failed',
        reason: intent.last_payment_error?.message,
      };
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      const companyId = charge.metadata?.companyId;
      if (!paymentIntentId || !companyId) {
        return null;
      }
      return { companyId, gatewayReference: paymentIntentId, result: 'refunded' };
    }
    return null;
  }

  private translateError(error: unknown): Error {
    if (error instanceof Stripe.errors.StripeCardError) {
      return new PaymentGatewayDeclinedError(error.message);
    }
    if (
      error instanceof Stripe.errors.StripeConnectionError ||
      error instanceof Stripe.errors.StripeAPIError
    ) {
      return new PaymentGatewayUnavailableError('stripe', error.message);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
