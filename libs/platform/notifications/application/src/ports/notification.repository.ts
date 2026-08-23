import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Notification, NotificationId } from '@platform/notifications/domain';

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');

export interface NotificationRepository {
  // companyId opcional: HandleDeliveryConfirmationHandler corre desde WhatsAppWebhookController
  // (@Public(), sin RequestContext) y siempre pasa el companyId explicito resuelto de
  // biz_opaque_callback_data - mismo mecanismo que SecurityDepositRepository.findById.
  findById(id: NotificationId, companyId?: string): Promise<Notification | null>;
  save(notification: Notification, tx: UnitOfWorkTransaction): Promise<void>;
}
