import { Module } from '@nestjs/common';

import { IntegrationProvidersModule } from '@platform/integration-providers/infrastructure';
import { SettingsModule } from '@platform/settings/infrastructure';
import {
  HandleDeliveryConfirmationHandler,
  NOTIFICATION_REPOSITORY,
  SendNotificationHandler,
} from '@platform/notifications/application';

import { UserWelcomeNotificationListener } from './events/user-welcome-notification.listener';
import { NotificationsController } from './http/notifications.controller';
import { WhatsAppWebhookController } from './http/webhooks/whatsapp-webhook.controller';
import { PrismaNotificationRepository } from './persistence/prisma/prisma-notification.repository';
import { GetNotificationHandler } from './queries/get-notification.handler';
import { ListNotificationsHandler } from './queries/list-notifications.handler';

// Importa SettingsModule (SETTINGS_LOOKUP_PORT, notification channel preference) e
// IntegrationProvidersModule (NOTIFICATION_SENDER_PORT/PUSH_NOTIFICATION_SENDER_PORT) - mismo
// patron que PaymentsModule. Sin exports: Notifications no publica ningun puerto sincrono
// cross-modulo (Hallazgo #5 del plan - el destinatario llega ya resuelto en el payload del
// evento que dispara la notificacion).
@Module({
  imports: [SettingsModule, IntegrationProvidersModule],
  controllers: [NotificationsController, WhatsAppWebhookController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    SendNotificationHandler,
    HandleDeliveryConfirmationHandler,
    GetNotificationHandler,
    ListNotificationsHandler,
    UserWelcomeNotificationListener,
  ],
})
export class NotificationsModule {}
