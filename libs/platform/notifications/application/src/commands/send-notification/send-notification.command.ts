import type { NotificationKindValue } from '@platform/notifications/domain';

export interface SendNotificationCommand {
  companyId: string;
  kind: NotificationKindValue;
  recipient: { email?: string; phone?: string; deviceToken?: string };
  templateId: string;
  templateParams?: Record<string, string>;
}
