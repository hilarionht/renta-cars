import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_PROVIDER_PORT } from '@platform/files/application';
import {
  NOTIFICATION_SENDER_PORT,
  PUSH_NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from '@platform/notifications/application';
import {
  MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
  PAYMENT_GATEWAY_PORT,
  STRIPE_WEBHOOK_TRANSLATOR_PORT,
  type PaymentGatewayPort,
} from '@platform/payments/application';

import { FakePaymentGatewayAdapter } from './providers/payment-fake/fake-payment-gateway.adapter';
import { MercadoPagoPaymentGatewayAdapter } from './providers/payment-mercadopago/mercadopago-payment-gateway.adapter';
import { StripePaymentGatewayAdapter } from './providers/payment-stripe/stripe-payment-gateway.adapter';
import { EmailChannelSender } from './providers/notification-email/email-channel-sender.adapter';
import { FakeNotificationSenderAdapter } from './providers/notification-fake/fake-notification-sender.adapter';
import { NotificationSenderAdapter } from './providers/notification-composite/notification-sender.adapter';
import { PushSenderAdapter } from './providers/notification-push/push-sender.adapter';
import { SmsChannelSender } from './providers/notification-sms/sms-channel-sender.adapter';
import { WhatsAppChannelSender } from './providers/notification-whatsapp/whatsapp-channel-sender.adapter';
import { S3StorageProviderAdapter } from './providers/storage-s3/s3-storage-provider.adapter';

// Agrupa TODOS los adaptadores de proveedores externos (docs/ADR/0010-provider-pattern-
// integraciones.md). Cada adaptador importa el puerto del modulo de negocio que lo definio
// (@platform/files/application, @platform/payments/application, @platform/notifications/
// application) - la direccion de dependencia es "el proveedor conoce al consumidor", inversa
// de la habitual "consumidor conoce al proveedor generico" - permitida por tooling/eslint/
// boundaries.mjs (type:infrastructure/type:application no estan restringidos por modulo en
// ninguna direccion). PAYMENT_GATEWAY_PORT selecciona el adaptador activo por config
// (PAYMENT_GATEWAY_PROVIDER, nunca hardcodeado, ADR-0010) - mismo mecanismo para
// NOTIFICATION_SENDER_PORT (NOTIFICATION_SENDER_PROVIDER=fake|real), salvo que en modo "real"
// el adaptador seleccionado es el compuesto (NotificationSenderAdapter) que enruta
// internamente por canal (Hallazgo #9 del plan - los 3 canales de mensajeria estan
// simultaneamente activos en modo real, a diferencia de Stripe/MercadoPago donde se activa
// UNO). PUSH_NOTIFICATION_SENDER_PORT se bindea directo (sin useFactory, sin consumidor real
// esta tanda). Los adaptadores concretos NUNCA se exportan directo - "solo el modulo es
// publico" (docs/technical/09-CODING-STANDARDS.md SS2).
@Module({
  providers: [
    { provide: STORAGE_PROVIDER_PORT, useClass: S3StorageProviderAdapter },
    FakePaymentGatewayAdapter,
    StripePaymentGatewayAdapter,
    MercadoPagoPaymentGatewayAdapter,
    {
      provide: PAYMENT_GATEWAY_PORT,
      inject: [
        ConfigService,
        FakePaymentGatewayAdapter,
        StripePaymentGatewayAdapter,
        MercadoPagoPaymentGatewayAdapter,
      ],
      useFactory: (
        configService: ConfigService,
        fake: FakePaymentGatewayAdapter,
        stripe: StripePaymentGatewayAdapter,
        mercadopago: MercadoPagoPaymentGatewayAdapter,
      ): PaymentGatewayPort => {
        const provider = configService.getOrThrow<string>('payments.gatewayProvider');
        if (provider === 'stripe') {
          return stripe;
        }
        if (provider === 'mercadopago') {
          return mercadopago;
        }
        return fake;
      },
    },
    { provide: STRIPE_WEBHOOK_TRANSLATOR_PORT, useExisting: StripePaymentGatewayAdapter },
    {
      provide: MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
      useExisting: MercadoPagoPaymentGatewayAdapter,
    },
    WhatsAppChannelSender,
    EmailChannelSender,
    SmsChannelSender,
    FakeNotificationSenderAdapter,
    NotificationSenderAdapter,
    PushSenderAdapter,
    {
      provide: NOTIFICATION_SENDER_PORT,
      inject: [ConfigService, FakeNotificationSenderAdapter, NotificationSenderAdapter],
      useFactory: (
        configService: ConfigService,
        fake: FakeNotificationSenderAdapter,
        real: NotificationSenderAdapter,
      ): NotificationSenderPort => {
        const provider = configService.getOrThrow<string>('notifications.senderProvider');
        return provider === 'real' ? real : fake;
      },
    },
    { provide: PUSH_NOTIFICATION_SENDER_PORT, useExisting: PushSenderAdapter },
  ],
  exports: [
    STORAGE_PROVIDER_PORT,
    PAYMENT_GATEWAY_PORT,
    STRIPE_WEBHOOK_TRANSLATOR_PORT,
    MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
    NOTIFICATION_SENDER_PORT,
    PUSH_NOTIFICATION_SENDER_PORT,
  ],
})
export class IntegrationProvidersModule {}
