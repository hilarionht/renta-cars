import { Module } from '@nestjs/common';

import { IntegrationProvidersModule } from '@platform/integration-providers/infrastructure';
import { SettingsModule } from '@platform/settings/infrastructure';
import {
  HandleDeliveryConfirmationHandler,
  NOTIFICATION_REPOSITORY,
  SendNotificationHandler,
  SendPushNotificationHandler,
} from '@platform/notifications/application';

import { UserWelcomeNotificationListener } from './events/user-welcome-notification.listener';
import { NotificationsController } from './http/notifications.controller';
import { WhatsAppWebhookController } from './http/webhooks/whatsapp-webhook.controller';
import { PrismaNotificationRepository } from './persistence/prisma/prisma-notification.repository';
import { GetNotificationHandler } from './queries/get-notification.handler';
import { ListNotificationsHandler } from './queries/list-notifications.handler';

// Importa SettingsModule (SETTINGS_LOOKUP_PORT, notification channel preference) e
// IntegrationProvidersModule (NOTIFICATION_SENDER_PORT/PUSH_NOTIFICATION_SENDER_PORT) - mismo
// patron que PaymentsModule. Exporta SendNotificationHandler (Fase 3 item 3,
// docs/persistence/10-DECISIONES.md #98) - Notifications no puede alcanzar Reservations/
// Invoices/Customers (boundaries.mjs bloquea scope:platform -> scope:product-rental en
// cualquier capa), asi que sus listeners viven DENTRO de reservations/infrastructure e
// invoices/infrastructure, importando este modulo directo para llamar el handler - mismo
// patron ya usado para SettingsModule. Las otras 4 dependencias de SendNotificationHandler
// (NOTIFICATION_REPOSITORY, NOTIFICATION_SENDER_PORT, SETTINGS_LOOKUP_PORT, UNIT_OF_WORK/
// DOMAIN_EVENT_PUBLISHER via @Global() PrismaModule) ya resuelven completas sin exportarlas.
// SendPushNotificationHandler exportado igual (docs/persistence/10-DECISIONES.md #122) -
// unico camino permitido hacia PUSH_NOTIFICATION_SENDER_PORT para cualquier consumidor
// cross-modulo (docs/contracts/05-INTEGRATION-CONTRACTS.md SS2), primer consumidor real:
// SendReservationReminderProcessor (reservations/infrastructure).
@Module({
  imports: [SettingsModule, IntegrationProvidersModule],
  controllers: [NotificationsController, WhatsAppWebhookController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    SendNotificationHandler,
    SendPushNotificationHandler,
    HandleDeliveryConfirmationHandler,
    GetNotificationHandler,
    ListNotificationsHandler,
    UserWelcomeNotificationListener,
  ],
  exports: [SendNotificationHandler, SendPushNotificationHandler],
})
export class NotificationsModule {}
