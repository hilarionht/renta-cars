import { Module } from '@nestjs/common';

import { IntegrationProvidersModule } from '@platform/integration-providers/infrastructure';
import { SettingsModule } from '@platform/settings/infrastructure';
import {
  AuthorizePaymentHandler,
  CapturePaymentHandler,
  HandleGatewayWebhookHandler,
  HoldSecurityDepositHandler,
  PAYMENT_REPOSITORY,
  ReleaseSecurityDepositHandler,
  RefundPaymentHandler,
  RequestPaymentHandler,
  RetainSecurityDepositHandler,
  SECURITY_DEPOSIT_REPOSITORY,
} from '@platform/payments/application';

import { SecurityDepositHoldListener } from './events/security-deposit-hold.listener';
import { SecurityDepositResolveListener } from './events/security-deposit-resolve.listener';
import { MercadoPagoWebhookController } from './http/webhooks/mercadopago-webhook.controller';
import { StripeWebhookController } from './http/webhooks/stripe-webhook.controller';
import { PaymentsController } from './http/payments.controller';
import { SecurityDepositsController } from './http/security-deposits.controller';
import { PrismaPaymentRepository } from './persistence/prisma/prisma-payment.repository';
import { PrismaSecurityDepositRepository } from './persistence/prisma/prisma-security-deposit.repository';
import { GetPaymentHandler } from './queries/get-payment.handler';
import { GetSecurityDepositHandler } from './queries/get-security-deposit.handler';
import { ListPaymentsHandler } from './queries/list-payments.handler';
import { ListSecurityDepositsHandler } from './queries/list-security-deposits.handler';

// Importa SettingsModule (SETTINGS_LOOKUP_PORT, deposit policy + payment methods enabled) e
// IntegrationProvidersModule (PAYMENT_GATEWAY_PORT + los 2 webhook translator ports) - mismo
// patron que ReservationsModule. Sin exports: Payments no publica ningun puerto sincrono
// cross-modulo (Commerce es 100% event-driven respecto de Rental Operations, docs/model/
// 09-DEPENDENCIES.md SS2/SS3).
@Module({
  imports: [SettingsModule, IntegrationProvidersModule],
  controllers: [
    PaymentsController,
    SecurityDepositsController,
    StripeWebhookController,
    MercadoPagoWebhookController,
  ],
  providers: [
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: SECURITY_DEPOSIT_REPOSITORY, useClass: PrismaSecurityDepositRepository },
    RequestPaymentHandler,
    AuthorizePaymentHandler,
    CapturePaymentHandler,
    RefundPaymentHandler,
    HoldSecurityDepositHandler,
    ReleaseSecurityDepositHandler,
    RetainSecurityDepositHandler,
    HandleGatewayWebhookHandler,
    GetPaymentHandler,
    ListPaymentsHandler,
    GetSecurityDepositHandler,
    ListSecurityDepositsHandler,
    SecurityDepositHoldListener,
    SecurityDepositResolveListener,
  ],
})
export class PaymentsModule {}
