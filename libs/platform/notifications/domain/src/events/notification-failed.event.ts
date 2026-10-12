export interface NotificationFailedEvent {
  eventType: 'NotificationFailed.v1';
  notificationId: string;
  reason: string;
  channelsExhausted: boolean;
}
