// Superficie publica de "platform-notifications-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Notification, type NotificationId, type NotificationProps } from './entities/notification';

export { CHANNELS, type ChannelValue } from './value-objects/channel';
export type { NotificationStatusValue } from './value-objects/notification-status';
export { NOTIFICATION_KINDS, type NotificationKindValue } from './value-objects/notification-kind';
export { Recipient, type RecipientProps } from './value-objects/recipient';

export { NotificationNotFoundError } from './errors/notification-not-found.error';
export { NotificationInvalidStateTransitionError } from './errors/notification-invalid-state-transition.error';
export { NotificationDeliveryFailedError } from './errors/notification-delivery-failed.error';
export { PushTokenInvalidError } from './errors/push-token-invalid.error';

export type { NotificationSentEvent } from './events/notification-sent.event';
export type { NotificationDeliveredEvent } from './events/notification-delivered.event';
export type { NotificationFailedEvent } from './events/notification-failed.event';
