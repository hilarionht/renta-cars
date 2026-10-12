export interface GetNotificationQuery {
  companyId: string;
  notificationId: string;
}

export interface NotificationSummary {
  id: string;
  kind: string;
  status: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientDeviceToken?: string;
  templateId: string;
  channel?: string;
  providerReference?: string;
  failureReason?: string;
  channelsExhausted: boolean;
  deliveredAt?: string;
  createdAt: string;
}
