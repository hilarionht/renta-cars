import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';
import {
  Notification,
  type NotificationId,
  NotificationDeliveryFailedError,
  Recipient,
} from '@platform/notifications/domain';

import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../ports/notification.repository';
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from '../../ports/notification-sender.port';
import type { SendNotificationCommand } from './send-notification.command';

// Orden de fallback pragmatico (Hallazgo #12, sin tabla cerrada evento->canal documentada):
// [preferido de CompanySettings, resto en prioridad WhatsApp > Email > SMS]. Push queda fuera
// - NOTIFICATION_SENDER_PORT solo cubre los 3 canales de mensajeria (Hallazgo #9).
const CHANNEL_PRIORITY: Array<'WhatsApp' | 'Email' | 'SMS'> = ['WhatsApp', 'Email', 'SMS'];

@Injectable()
export class SendNotificationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSenderPort: NotificationSenderPort,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookupPort: SettingsLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: SendNotificationCommand): Promise<NotificationId> {
    const recipient = Recipient.from(command.recipient);
    const notification = Notification.create({
      companyId: command.companyId,
      kind: command.kind,
      recipient,
      templateId: command.templateId,
    });

    // Persistencia propia de la creacion Pending (Hallazgo del plan, paso 1) - si el proceso
    // muere antes de que algun canal responda, el registro Pending ya quedo en base.
    await this.unitOfWork.run(async (tx) => {
      await this.notificationRepository.save(notification, tx);
    }, command.companyId);

    const channelOrder = command.requireExactChannel
      ? [command.requireExactChannel]
      : this.resolveChannelOrder(
          await this.settingsLookupPort.getNotificationChannelPreference(command.companyId),
        );

    let lastFailureReason: string | undefined;
    for (const channel of channelOrder) {
      if (!recipient.hasChannel(channel)) {
        continue;
      }
      try {
        const result = await this.notificationSenderPort.send({
          channel,
          recipient: { email: recipient.email, phone: recipient.phone },
          templateId: command.templateId,
          templateParams: command.templateParams ?? {},
          notificationId: notification.id.toString(),
          companyId: command.companyId,
        });
        notification.send(channel, result.providerReference);
        await this.persistAndPublish(notification);
        return notification.id;
      } catch (error) {
        lastFailureReason = error instanceof Error ? error.message : String(error);
      }
    }

    const failureReason =
      lastFailureReason ?? 'El destinatario no tiene datos de contacto para ningun canal.';
    notification.fail(failureReason, true);
    await this.persistAndPublish(notification);

    if (command.requireExactChannel) {
      throw new NotificationDeliveryFailedError(command.requireExactChannel, failureReason);
    }
    return notification.id;
  }

  private resolveChannelOrder(
    preferredChannel: string | null,
  ): Array<'WhatsApp' | 'Email' | 'SMS'> {
    const preferred = CHANNEL_PRIORITY.find((channel) => channel === preferredChannel);
    if (!preferred) {
      return CHANNEL_PRIORITY;
    }
    return [preferred, ...CHANNEL_PRIORITY.filter((channel) => channel !== preferred)];
  }

  private async persistAndPublish(notification: Notification): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      await this.notificationRepository.save(notification, tx);
      for (const event of notification.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Notification',
          aggregateId: notification.id.toString(),
          companyId: notification.companyId,
          payload: { ...event },
        });
      }
    }, notification.companyId);
  }
}
