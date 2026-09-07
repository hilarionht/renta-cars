export interface NotificationDeliveredEvent {
  eventType: 'NotificationDelivered.v1';
  notificationId: string;
  deliveredAt: string;
}
