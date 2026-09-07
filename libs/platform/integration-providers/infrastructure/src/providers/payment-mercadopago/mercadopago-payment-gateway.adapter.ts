import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  MercadoPagoError,
  MPConnectionError,
  MPPaymentError,
  Payment as MercadoPagoPayment,
  PaymentRefund,
  WebhookSignatureValidator,
} from 'mercadopago';

import type {
  AuthorizePaymentInput,
  CapturePaymentInput,
  HandleGatewayWebhookCommand,
  MercadoPagoWebhookBody,
  MercadoPagoWebhookHeaders,
  MercadoPagoWebhookTranslatorPort,
  PaymentGatewayPort,
  PaymentGatewayResult,
  PaymentGatewayStatus,
  RefundPaymentInput,
} from '@platform/payments/application';
import {
  PaymentGatewayDeclinedError,
  PaymentGatewayUnavailableError,
} from '@platform/payments/application';

interface MercadoPagoGatewayConfig {
  accessToken: string;
  webhookSecret: string;
}

// docs/11-INTEGRACIONES.md SS6 - SDK oficial "mercadopago" real. Sin credenciales reales de
// Mercado Pago disponibles en este entorno de desarrollo (decision de alcance explicita del
// usuario, docs/persistence/10-DECISIONES.md Fase 2): codigo completo y listo, pero NO
// ejercido contra la API viva en el smoke test de esta tanda.
@Injectable()
export class MercadoPagoPaymentGatewayAdapter
  implements PaymentGatewayPort, MercadoPagoWebhookTranslatorPort
{
  private readonly paymentClient: MercadoPagoPayment;
  private readonly refundClient: PaymentRefund;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    const mpConfig = configService.getOrThrow<MercadoPagoGatewayConfig>('payments.mercadopago');
    const client = new MercadoPagoConfig({ accessToken: mpConfig.accessToken });
    this.paymentClient = new MercadoPagoPayment(client);
    this.refundClient = new PaymentRefund(client);
    this.webhookSecret = mpConfig.webhookSecret;
  }

  async authorize(input: AuthorizePaymentInput): Promise<PaymentGatewayResult> {
    try {
      const result = await this.paymentClient.create({
        body: {
          // Mercado Pago expresa transaction_amount en unidad mayor (con decimales), no en
          // minorUnits enteros como el resto del dominio (docs/04-MODELO-DATOS.md SS5).
          transaction_amount: input.amount.minorUnits / 100,
          capture: false,
          description: `Payment ${input.idempotencyKey}`,
          // Unica forma de que verifyAndTranslateWebhook() resuelva el tenant de un webhook
          // entrante sin RequestContext (ruta @Public(), RLS fail-closed).
          metadata: { companyId: input.companyId },
        },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      });
      if (!result.id) {
        throw new PaymentGatewayUnavailableError('mercadopago', 'Respuesta de create() sin id');
      }
      return { gatewayReference: String(result.id) };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async capture(input: CapturePaymentInput): Promise<PaymentGatewayResult> {
    if (!input.gatewayReference) {
      throw new PaymentGatewayUnavailableError(
        'mercadopago',
        'capture() sin gatewayReference previo',
      );
    }
    try {
      const result = await this.paymentClient.capture({ id: input.gatewayReference });
      return { gatewayReference: String(result.id ?? input.gatewayReference) };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async refund(input: RefundPaymentInput): Promise<PaymentGatewayResult> {
    try {
      const result = await this.refundClient.create({ payment_id: input.gatewayReference });
      return { gatewayReference: String(result.id ?? input.gatewayReference) };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async getStatus(gatewayReference: string): Promise<PaymentGatewayStatus> {
    const result = await this.paymentClient.get({ id: gatewayReference });
    if (result.status === 'approved') {
      return 'succeeded';
    }
    if (result.status === 'rejected' || result.status === 'cancelled') {
      return 'failed';
    }
    return 'pending';
  }

  // docs/contracts/06-WEBHOOKS.md - verificacion de firma nativa del SDK
  // (WebhookSignatureValidator.validate), no manual - a diferencia de lo previsto en el plan
  // (el gap documentado ahi era sobre versiones previas de la SDK; mercadopago@3.4.0 ya la
  // expone). La notificacion solo trae data.id - el status real se resuelve con un GET
  // adicional (nunca se infiere del nombre de la accion, que no distingue aprobado/rechazado).
  async verifyAndTranslateWebhook(
    body: MercadoPagoWebhookBody,
    headers: MercadoPagoWebhookHeaders,
  ): Promise<HandleGatewayWebhookCommand | null> {
    try {
      WebhookSignatureValidator.validate({
        xSignature: headers.xSignature,
        xRequestId: headers.xRequestId,
        dataId: headers.dataId,
        secret: this.webhookSecret,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException(
          `Firma de webhook de Mercado Pago invalida: ${error.reason}`,
        );
      }
      throw error;
    }

    const dataId = body.data?.id;
    if (!dataId) {
      return null;
    }

    const payment = await this.paymentClient.get({ id: dataId });
    const companyId = (payment.metadata as { companyId?: string } | undefined)?.companyId;
    if (!companyId) {
      return null;
    }
    if (payment.status === 'approved') {
      return { companyId, gatewayReference: dataId, result: 'captured' };
    }
    if (payment.status === 'refunded') {
      return { companyId, gatewayReference: dataId, result: 'refunded' };
    }
    if (payment.status === 'rejected' || payment.status === 'cancelled') {
      return {
        companyId,
        gatewayReference: dataId,
        result: 'failed',
        reason: payment.status_detail,
      };
    }
    return null;
  }

  private translateError(error: unknown): Error {
    if (error instanceof MPPaymentError) {
      return new PaymentGatewayDeclinedError(error.message);
    }
    if (error instanceof MPConnectionError || error instanceof MercadoPagoError) {
      return new PaymentGatewayUnavailableError('mercadopago', error.message);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
