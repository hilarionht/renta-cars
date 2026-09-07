export interface NotificationSentEvent {
  eventType: 'NotificationSent.v1';
  notificationId: string;
  channel: string;
  kind: string;
}
