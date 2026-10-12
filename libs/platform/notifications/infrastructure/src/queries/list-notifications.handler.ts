import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  ListNotificationsQuery,
  ListNotificationsResult,
} from '@platform/notifications/application';

@Injectable()
export class ListNotificationsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListNotificationsQuery): Promise<ListNotificationsResult> {
    const records = await this.readTransaction.run(
      (tx) => tx.notification.findMany({ orderBy: { createdAt: 'desc' } }),
      query.companyId,
    );

    return {
      items: records.map((record) => ({
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
      })),
    };
  }
}
