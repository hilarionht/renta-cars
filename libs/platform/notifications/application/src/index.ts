// Superficie publica de "platform-notifications-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from './ports/notification.repository';
export {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderRecipient,
  type NotificationSenderInput,
  type NotificationSenderResult,
  type NotificationSenderPort,
} from './ports/notification-sender.port';
export {
  PUSH_NOTIFICATION_SENDER_PORT,
  type PushNotificationInput,
  type PushNotificationResult,
  type PushNotificationSenderPort,
} from './ports/push-notification-sender.port';
// Re-exportado desde domain (docs/persistence/10-DECISIONES.md #122) - unica forma en que
// PushSenderAdapter (platform-integration-providers-infrastructure) puede tirarlo: ese
// proyecto tiene bloqueado boundaries.mjs para depender de "type:domain" de otro modulo,
// solo de su "type:application" (mismo motivo por el que los puertos de arriba se importan
// de application, nunca de domain, en cualquier adaptador).
export { PushTokenInvalidError } from '@platform/notifications/domain';

export { SendNotificationHandler } from './commands/send-notification/send-notification.handler';
export type { SendNotificationCommand } from './commands/send-notification/send-notification.command';
export { HandleDeliveryConfirmationHandler } from './commands/handle-delivery-confirmation/handle-delivery-confirmation.handler';
export type { HandleDeliveryConfirmationCommand } from './commands/handle-delivery-confirmation/handle-delivery-confirmation.command';
export { SendPushNotificationHandler } from './commands/send-push-notification/send-push-notification.handler';
export type { SendPushNotificationCommand } from './commands/send-push-notification/send-push-notification.command';

export type {
  GetNotificationQuery,
  NotificationSummary,
} from './queries/get-notification/get-notification.query';
export type {
  ListNotificationsQuery,
  ListNotificationsResult,
} from './queries/list-notifications/list-notifications.query';
