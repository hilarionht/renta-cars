import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { NotificationNotFoundError } from '@platform/notifications/domain';

import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../ports/notification.repository';
import type { HandleDeliveryConfirmationCommand } from './handle-delivery-confirmation.command';

// Traduce el webhook de estado de WhatsApp (Hallazgo #10) - notificationId/companyId ya
// resueltos por el caller via biz_opaque_callback_data, sin lookup por referencia opaca.
// Idempotente por estado destino (mismo criterio que HandleGatewayWebhookHandler de Payments):
// una reentrega del proveedor nunca vuelve a emitir el evento ni a bumpear version.
@Injectable()
export class HandleDeliveryConfirmationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: HandleDeliveryConfirmationCommand): Promise<void> {
    const notification = await this.notificationRepository.findById(
      EntityId.from<'Notification'>(command.notificationId),
      command.companyId,
    );
    if (!notification) {
      throw new NotificationNotFoundError(command.notificationId);
    }

    if (command.outcome === 'delivered') {
      if (notification.status === 'Delivered') {
        return;
      }
      notification.markDelivered();
    } else {
      if (notification.status === 'Failed') {
        return;
      }
      notification.markFailed(command.reason ?? 'Fallo reportado por el proveedor.');
    }

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
