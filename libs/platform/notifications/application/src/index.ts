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

export { SendNotificationHandler } from './commands/send-notification/send-notification.handler';
export type { SendNotificationCommand } from './commands/send-notification/send-notification.command';
export { HandleDeliveryConfirmationHandler } from './commands/handle-delivery-confirmation/handle-delivery-confirmation.handler';
export type { HandleDeliveryConfirmationCommand } from './commands/handle-delivery-confirmation/handle-delivery-confirmation.command';

export type {
  GetNotificationQuery,
  NotificationSummary,
} from './queries/get-notification/get-notification.query';
export type {
  ListNotificationsQuery,
  ListNotificationsResult,
} from './queries/list-notifications/list-notifications.query';
