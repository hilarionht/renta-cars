import { Injectable } from '@nestjs/common';
import type { Notification as PrismaNotification } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { Notification, type NotificationId, Recipient } from '@platform/notifications/domain';
import type { NotificationRepository } from '@platform/notifications/application';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: NotificationId, companyId?: string): Promise<Notification | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.notification.findFirst({ where: { id: id.toString() } }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(notification: Notification, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: notification.companyId,
      kind: notification.kind,
      status: notification.status,
      recipientEmail: notification.recipient.email ?? null,
      recipientPhone: notification.recipient.phone ?? null,
      recipientDeviceToken: notification.recipient.deviceToken ?? null,
      templateId: notification.templateId,
      channel: notification.channel ?? null,
      providerReference: notification.providerReference ?? null,
      failureReason: notification.failureReason ?? null,
      channelsExhausted: notification.channelsExhausted,
      deliveredAt: notification.deliveredAt ?? null,
    };

    if (notification.isNew) {
      await prisma.notification.create({
        data: { id: notification.id.toString(), ...rootData, version: notification.version },
      });
      notification.markPersisted();
    } else {
      const result = await prisma.notification.updateMany({
        where: { id: notification.id.toString(), version: notification.version - 1 },
        data: {
          status: rootData.status,
          channel: rootData.channel,
          providerReference: rootData.providerReference,
          failureReason: rootData.failureReason,
          channelsExhausted: rootData.channelsExhausted,
          deliveredAt: rootData.deliveredAt,
          version: notification.version,
        },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('Notification', notification.id.toString());
      }
    }
  }

  private toDomain(record: PrismaNotification): Notification {
    return Notification.reconstitute({
      id: EntityId.from<'Notification'>(record.id),
      companyId: record.companyId,
      kind: record.kind,
      status: record.status,
      recipient: Recipient.from({
        email: record.recipientEmail ?? undefined,
        phone: record.recipientPhone ?? undefined,
        deviceToken: record.recipientDeviceToken ?? undefined,
      }),
      templateId: record.templateId,
      channel: record.channel ?? undefined,
      providerReference: record.providerReference ?? undefined,
      failureReason: record.failureReason ?? undefined,
      channelsExhausted: record.channelsExhausted,
      deliveredAt: record.deliveredAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
