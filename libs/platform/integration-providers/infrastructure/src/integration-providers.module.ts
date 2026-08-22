import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_PROVIDER_PORT } from '@platform/files/application';
import {
  MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
  PAYMENT_GATEWAY_PORT,
  STRIPE_WEBHOOK_TRANSLATOR_PORT,
  type PaymentGatewayPort,
} from '@platform/payments/application';

import { FakePaymentGatewayAdapter } from './providers/payment-fake/fake-payment-gateway.adapter';
import { MercadoPagoPaymentGatewayAdapter } from './providers/payment-mercadopago/mercadopago-payment-gateway.adapter';
import { StripePaymentGatewayAdapter } from './providers/payment-stripe/stripe-payment-gateway.adapter';
import { S3StorageProviderAdapter } from './providers/storage-s3/s3-storage-provider.adapter';

// Agrupa TODOS los adaptadores de proveedores externos (docs/ADR/0010-provider-pattern-
// integraciones.md). Cada adaptador importa el puerto del modulo de negocio que lo definio
// (@platform/files/application, @platform/payments/application) - la direccion de
// dependencia es "el proveedor conoce al consumidor", inversa de la habitual "consumidor
// conoce al proveedor generico" - permitida por tooling/eslint/boundaries.mjs
// (type:infrastructure/type:application no estan restringidos por modulo en ninguna
// direccion). PAYMENT_GATEWAY_PORT selecciona el adaptador activo por config
// (PAYMENT_GATEWAY_PROVIDER, nunca hardcodeado, ADR-0010). Los adaptadores concretos
// (Stripe/MercadoPago) NUNCA se exportan directo - "solo el modulo es publico" (docs/
// technical/09-CODING-STANDARDS.md SS2, mismo criterio que S3StorageProviderAdapter) - los
// webhook controllers de payments/infrastructure inyectan STRIPE_WEBHOOK_TRANSLATOR_PORT/
// MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT (useExisting), nunca la clase concreta.
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
  ],
  exports: [
    STORAGE_PROVIDER_PORT,
    PAYMENT_GATEWAY_PORT,
    STRIPE_WEBHOOK_TRANSLATOR_PORT,
    MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
  ],
})
export class IntegrationProvidersModule {}
