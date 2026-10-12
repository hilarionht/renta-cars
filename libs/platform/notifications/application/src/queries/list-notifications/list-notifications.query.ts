import type { NotificationSummary } from '../get-notification/get-notification.query';

export interface ListNotificationsQuery {
  companyId: string;
}

export interface ListNotificationsResult {
  items: NotificationSummary[];
}
