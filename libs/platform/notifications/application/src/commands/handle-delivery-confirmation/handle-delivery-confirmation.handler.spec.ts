import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Notification, NotificationNotFoundError, Recipient } from '@platform/notifications/domain';

import { HandleDeliveryConfirmationHandler } from './handle-delivery-confirmation.handler';
import type { NotificationRepository } from '../../ports/notification.repository';

function buildSentNotification(): Notification {
  const notification = Notification.create({
    companyId: 'company-1',
    kind: 'Alert',
    recipient: Recipient.from({ email: 'user@example.com' }),
    templateId: 'user-welcome',
  });
  notification.send('Email', 'provider-ref-1');
  notification.pullDomainEvents();
  return notification;
}

function buildHandler(notification: Notification | null) {
  const notificationRepository: NotificationRepository = {
    findById: jest.fn().mockResolvedValue(notification),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new HandleDeliveryConfirmationHandler(
    notificationRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, notificationRepository, eventPublisher };
}

describe('HandleDeliveryConfirmationHandler', () => {
  it('transiciona Sent -> Delivered y publica NotificationDelivered.v1', async () => {
    const notification = buildSentNotification();
    const { handler, notificationRepository, eventPublisher } = buildHandler(notification);

    await handler.execute({
      notificationId: notification.id.toString(),
      companyId: 'company-1',
      outcome: 'delivered',
    });

    expect(notification.status).toBe('Delivered');
    expect(notificationRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'NotificationDelivered.v1' }),
    );
  });

  it('transiciona Sent -> Failed y publica NotificationFailed.v1 con channelsExhausted false', async () => {
    const notification = buildSentNotification();
    const { handler, eventPublisher } = buildHandler(notification);

    await handler.execute({
      notificationId: notification.id.toString(),
      companyId: 'company-1',
      outcome: 'failed',
      reason: 'rebotado por el proveedor',
    });

    expect(notification.status).toBe('Failed');
    expect(notification.channelsExhausted).toBe(false);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'NotificationFailed.v1' }),
    );
  });

  it('es idempotente: no-op si ya esta en el estado destino', async () => {
    const notification = buildSentNotification();
    notification.markDelivered();
    notification.pullDomainEvents();
    const { handler, notificationRepository, eventPublisher } = buildHandler(notification);

    await handler.execute({
      notificationId: notification.id.toString(),
      companyId: 'company-1',
      outcome: 'delivered',
    });

    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('lanza NotificationNotFoundError si no existe', async () => {
    const { handler } = buildHandler(null);
    const notFoundId = Notification.create({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: Recipient.from({ email: 'user@example.com' }),
      templateId: 'user-welcome',
    }).id.toString();

    await expect(
      handler.execute({
        notificationId: notFoundId,
        companyId: 'company-1',
        outcome: 'delivered',
      }),
    ).rejects.toThrow(NotificationNotFoundError);
  });
});
