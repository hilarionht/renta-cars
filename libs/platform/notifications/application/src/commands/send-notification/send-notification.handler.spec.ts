import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { SettingsLookupPort } from '@platform/settings/application';
import { NotificationDeliveryFailedError, type Notification } from '@platform/notifications/domain';

import { SendNotificationHandler } from './send-notification.handler';
import type { NotificationRepository } from '../../ports/notification.repository';
import type { NotificationSenderPort } from '../../ports/notification-sender.port';

function buildHandler(options: { preferredChannel?: string | null; send?: jest.Mock }) {
  const savedNotifications: Notification[] = [];
  const notificationRepository: NotificationRepository = {
    findById: jest.fn(),
    save: jest.fn((notification: Notification) => {
      savedNotifications.push(notification);
      return Promise.resolve();
    }),
  };
  const notificationSenderPort: NotificationSenderPort = {
    send: options.send ?? jest.fn().mockResolvedValue({ providerReference: 'provider-ref-1' }),
  };
  const settingsLookupPort = {
    getNotificationChannelPreference: jest.fn().mockResolvedValue(options.preferredChannel ?? null),
  } as unknown as SettingsLookupPort;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new SendNotificationHandler(
    notificationRepository,
    notificationSenderPort,
    settingsLookupPort,
    unitOfWork,
    eventPublisher,
  );

  return {
    handler,
    notificationRepository,
    notificationSenderPort,
    eventPublisher,
    savedNotifications,
  };
}

describe('SendNotificationHandler', () => {
  it('envia por el canal preferido y transiciona a Sent', async () => {
    const { handler, notificationSenderPort, eventPublisher, savedNotifications } = buildHandler({
      preferredChannel: 'Email',
    });

    const notificationId = await handler.execute({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: { email: 'user@example.com' },
      templateId: 'user-welcome',
    });

    expect(notificationId.toString()).toBeDefined();
    expect(notificationSenderPort.send).toHaveBeenCalledTimes(1);
    expect(notificationSenderPort.send).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'Email' }),
    );
    expect(savedNotifications[savedNotifications.length - 1].status).toBe('Sent');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'NotificationSent.v1', aggregateType: 'Notification' }),
    );
  });

  it('reintenta con el siguiente canal si el preferido falla (RN-34)', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('WhatsApp no disponible'))
      .mockResolvedValueOnce({ providerReference: 'provider-ref-2' });
    const { handler, savedNotifications } = buildHandler({ preferredChannel: 'WhatsApp', send });

    await handler.execute({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'user-welcome',
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(savedNotifications[savedNotifications.length - 1].status).toBe('Sent');
    expect(savedNotifications[savedNotifications.length - 1].channel).toBe('Email');
  });

  it('salta canales para los que el recipient no tiene dato', async () => {
    const send = jest.fn().mockResolvedValue({ providerReference: 'provider-ref-3' });
    const { handler } = buildHandler({ preferredChannel: 'WhatsApp', send });

    await handler.execute({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: { email: 'user@example.com' },
      templateId: 'user-welcome',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ channel: 'Email' }));
  });

  it('marca Failed con channelsExhausted true si todos los canales fallan', async () => {
    const send = jest.fn().mockRejectedValue(new Error('proveedor caido'));
    const { handler, eventPublisher, savedNotifications } = buildHandler({
      preferredChannel: 'Email',
      send,
    });

    await handler.execute({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: { email: 'user@example.com' },
      templateId: 'user-welcome',
    });

    const last = savedNotifications[savedNotifications.length - 1];
    expect(last.status).toBe('Failed');
    expect(last.channelsExhausted).toBe(true);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'NotificationFailed.v1' }),
    );
  });

  it('requireExactChannel: intenta solo ese canal, sin fallback, y sin consultar SettingsLookupPort', async () => {
    const send = jest.fn().mockResolvedValue({ providerReference: 'provider-ref-4' });
    const { handler, savedNotifications } = buildHandler({
      preferredChannel: 'Email',
      send,
    });

    await handler.execute({
      companyId: 'company-1',
      kind: 'Alert',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'customer-otp-login',
      requireExactChannel: 'WhatsApp',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ channel: 'WhatsApp' }));
    expect(savedNotifications[savedNotifications.length - 1].status).toBe('Sent');
  });

  it('requireExactChannel: si ese canal falla, marca Failed y lanza NotificationDeliveryFailedError (nunca reintenta otro canal)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('WhatsApp no disponible'));
    const { handler, savedNotifications } = buildHandler({ preferredChannel: 'Email', send });

    await expect(
      handler.execute({
        companyId: 'company-1',
        kind: 'Alert',
        recipient: { email: 'user@example.com', phone: '+525500000000' },
        templateId: 'customer-otp-login',
        requireExactChannel: 'WhatsApp',
      }),
    ).rejects.toThrow('WhatsApp no disponible');

    expect(send).toHaveBeenCalledTimes(1);
    const last = savedNotifications[savedNotifications.length - 1];
    expect(last.status).toBe('Failed');
    expect(last.channelsExhausted).toBe(true);
  });

  // docs/persistence/10-DECISIONES.md #145.
  describe('throwWhenUndelivered', () => {
    it('si se agotan todos los canales, marca Failed y lanza NotificationDeliveryFailedError', async () => {
      const send = jest.fn().mockRejectedValue(new Error('proveedor caido'));
      const { handler, savedNotifications } = buildHandler({ preferredChannel: 'Email', send });

      await expect(
        handler.execute({
          companyId: 'company-1',
          kind: 'Reminder',
          recipient: { email: 'user@example.com', phone: '+525500000000' },
          templateId: 'reservation-reminder',
          throwWhenUndelivered: true,
        }),
      ).rejects.toBeInstanceOf(NotificationDeliveryFailedError);

      // Email (preferido), WhatsApp y SMS: los tres canales del destinatario.
      expect(send).toHaveBeenCalledTimes(3);
      expect(savedNotifications[savedNotifications.length - 1].status).toBe('Failed');
    });

    it('si un canal sale, no lanza', async () => {
      const send = jest
        .fn()
        .mockRejectedValueOnce(new Error('WhatsApp caido'))
        .mockResolvedValue({ providerReference: 'ref-ok' });
      const { handler, savedNotifications } = buildHandler({ preferredChannel: 'WhatsApp', send });

      await handler.execute({
        companyId: 'company-1',
        kind: 'Reminder',
        recipient: { email: 'user@example.com', phone: '+525500000000' },
        templateId: 'reservation-reminder',
        throwWhenUndelivered: true,
      });

      expect(savedNotifications[savedNotifications.length - 1].status).toBe('Sent');
    });

    it("sin ningun canal en el destinatario, lanza con el canal 'none'", async () => {
      const send = jest.fn();
      const { handler } = buildHandler({ preferredChannel: 'Email', send });

      await expect(
        handler.execute({
          companyId: 'company-1',
          kind: 'Reminder',
          recipient: {},
          templateId: 'reservation-reminder',
          throwWhenUndelivered: true,
        }),
      ).rejects.toThrow('"none"');
      expect(send).not.toHaveBeenCalled();
    });

    it('sin la opcion, el comportamiento de siempre: marca Failed y no lanza', async () => {
      const send = jest.fn().mockRejectedValue(new Error('proveedor caido'));
      const { handler, savedNotifications } = buildHandler({ preferredChannel: 'Email', send });

      await handler.execute({
        companyId: 'company-1',
        kind: 'Reminder',
        recipient: { email: 'user@example.com' },
        templateId: 'reservation-reminder',
      });

      expect(savedNotifications[savedNotifications.length - 1].status).toBe('Failed');
    });
  });
});
