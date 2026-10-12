import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  GetNotificationQuery,
  NotificationSummary,
} from '@platform/notifications/application';
import { NotificationNotFoundError } from '@platform/notifications/domain';

@Injectable()
export class GetNotificationHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetNotificationQuery): Promise<NotificationSummary> {
    const record = await this.readTransaction.run(
      (tx) => tx.notification.findFirst({ where: { id: query.notificationId } }),
      query.companyId,
    );

    if (!record) {
      throw new NotificationNotFoundError(query.notificationId);
    }

    return {
      id: record.id,
      kind: record.kind,
      status: record.status,
      recipientEmail: record.recipientEmail ?? undefined,
      recipientPhone: record.recipientPhone ?? undefined,
      recipientDeviceToken: record.recipientDeviceToken ?? undefined,
      templateId: record.templateId,
      channel: record.channel ?? undefined,
      providerReference: record.providerReference ?? undefined,
      failureReason: record.failureReason ?? undefined,
      channelsExhausted: record.channelsExhausted,
      deliveredAt: record.deliveredAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
