import {
  PushTokenInvalidError,
  type SendNotificationHandler,
  type SendPushNotificationHandler,
} from '@platform/notifications/application';
import type { UnitOfWork } from '@platform/shared-kernel';
import type {
  CustomerLookupPort,
  RegisterCustomerPushTokenHandler,
} from '@rental/customers/application';

import type { ReminderDispatchStore } from '../persistence/prisma/reminder-dispatch.store';
import { SendReservationReminderProcessor } from './send-reservation-reminder.processor';

// docs/persistence/10-DECISIONES.md #121 y #145 ("al menos una vez").
type ContactInfo = { email: string; phone: string; name: string; pushDeviceToken?: string };

function buildJob(): Parameters<SendReservationReminderProcessor['process']>[0] {
  return {
    data: { reservationId: 'reservation-1', companyId: 'company-1', customerId: 'customer-1' },
  } as unknown as Parameters<SendReservationReminderProcessor['process']>[0];
}

function buildProcessor(options: {
  stillDue?: boolean;
  claimed?: number | null;
  contact?: ContactInfo | null;
  sendError?: Error;
  pushSendError?: Error;
  registerPushTokenError?: Error;
}) {
  const findFirst = jest
    .fn()
    .mockResolvedValue(options.stillDue === false ? null : { id: 'reservation-1' });
  const unitOfWork = {
    run: jest.fn((work: (tx: unknown) => unknown) => work({ reservation: { findFirst } })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as UnitOfWork;

  const store = {
    claim: jest.fn().mockResolvedValue(options.claimed === undefined ? 1 : options.claimed),
    markSent: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };

  const customerLookupPort: CustomerLookupPort = {
    isEligibleForConfirmation: jest.fn(),
    areAdditionalDriversValidated: jest.fn(),
    getContactInfo: jest
      .fn()
      .mockResolvedValue(
        options.contact === undefined
          ? { email: 'user@example.com', phone: '+525500000000', name: 'Customer 1' }
          : options.contact,
      ),
  };

  const execute = options.sendError
    ? jest.fn().mockRejectedValue(options.sendError)
    : jest.fn().mockResolvedValue('notification-1');
  const sendNotification = { execute } as unknown as SendNotificationHandler;

  const sendPush = options.pushSendError
    ? jest.fn().mockRejectedValue(options.pushSendError)
    : jest.fn().mockResolvedValue(undefined);
  const sendPushNotification = { execute: sendPush } as unknown as SendPushNotificationHandler;

  const registerPushToken = options.registerPushTokenError
    ? jest.fn().mockRejectedValue(options.registerPushTokenError)
    : jest.fn().mockResolvedValue(undefined);
  const registerCustomerPushToken = {
    execute: registerPushToken,
  } as unknown as RegisterCustomerPushTokenHandler;

  const processor = new SendReservationReminderProcessor(
    unitOfWork,
    customerLookupPort,
    sendNotification,
    sendPushNotification,
    registerCustomerPushToken,
    store as unknown as ReminderDispatchStore,
  );

  return { processor, store, findFirst, execute, sendPush, registerPushToken };
}

const withPush: ContactInfo = {
  email: 'user@example.com',
  phone: '+525500000000',
  name: 'Customer 1',
  pushDeviceToken: 'ExponentPushToken[abc]',
};

describe('SendReservationReminderProcessor', () => {
  it('reclama el intento, envia pidiendo que lance si no entrega, y marca Sent', async () => {
    const { processor, store, execute } = buildProcessor({});

    await processor.process(buildJob());

    expect(store.claim).toHaveBeenCalledWith('company-1', 'reservation-1', expect.any(Date));
    expect(execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      kind: 'Reminder',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'reservation-reminder',
      templateParams: { customerName: 'Customer 1', reservationId: 'reservation-1' },
      throwWhenUndelivered: true,
    });
    expect(store.markSent).toHaveBeenCalledWith('company-1', 'reservation-1', 1);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('si la reserva ya no aplica (cancelada o ya empezo), no reclama ni envia', async () => {
    const { processor, store, execute } = buildProcessor({ stillDue: false });

    await processor.process(buildJob());

    expect(store.claim).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('relee la reserva Confirmed, sin borrar y con inicio posterior a ahora', async () => {
    const { processor, findFirst } = buildProcessor({});

    await processor.process(buildJob());

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'reservation-1',
          companyId: 'company-1',
          status: 'Confirmed',
          deletedAt: null,
          startDate: { gt: expect.any(Date) },
        }),
      }),
    );
  });

  it('si otro intento lo tiene, ya salio o se agotaron los intentos (claim null), no envia', async () => {
    const { processor, execute, sendPush, store } = buildProcessor({
      claimed: null,
      contact: withPush,
    });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
    expect(store.markSent).not.toHaveBeenCalled();
  });

  it('si ningun canal entrega, marca Failed con el motivo y no relanza (reintenta el escaneo)', async () => {
    const { processor, store, sendPush } = buildProcessor({
      claimed: 2,
      contact: withPush,
      // En produccion es NotificationDeliveryFailedError; al processor le da igual el tipo.
      sendError: new Error('No se pudo enviar la notificacion por el canal "SMS": proveedor caido'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(store.markFailed).toHaveBeenCalledWith(
      'company-1',
      'reservation-1',
      2,
      expect.stringContaining('proveedor caido'),
    );
    expect(store.markSent).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('sin contacto del customer, cuenta como fallo (Failed), no queda Sending', async () => {
    const { processor, store, execute } = buildProcessor({ contact: null });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith(
      'company-1',
      'reservation-1',
      1,
      expect.stringContaining('customer-1'),
    );
  });

  it('con pushDeviceToken: envia el push despues de marcar Sent', async () => {
    const { processor, store, sendPush } = buildProcessor({ contact: withPush });
    const order: string[] = [];
    store.markSent.mockImplementation(() => {
      order.push('markSent');
      return Promise.resolve();
    });
    sendPush.mockImplementation(() => {
      order.push('push');
      return Promise.resolve();
    });

    await processor.process(buildJob());

    expect(order).toEqual(['markSent', 'push']);
    expect(sendPush).toHaveBeenCalledWith({
      deviceToken: 'ExponentPushToken[abc]',
      title: 'Recordatorio de tu reserva',
      body: 'Hola Customer 1, tu reserva esta por comenzar.',
      data: { reservationId: 'reservation-1' },
    });
  });

  it('sin pushDeviceToken: no intenta enviar push', async () => {
    const { processor, sendPush } = buildProcessor({});

    await processor.process(buildJob());

    expect(sendPush).not.toHaveBeenCalled();
  });

  it('push con PushTokenInvalidError: limpia el token, no rompe el job ni toca el despacho', async () => {
    const { processor, registerPushToken, store } = buildProcessor({
      contact: withPush,
      pushSendError: new PushTokenInvalidError('DeviceNotRegistered'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(registerPushToken).toHaveBeenCalledWith({
      customerId: 'customer-1',
      companyId: 'company-1',
      deviceToken: null,
    });
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('si limpiar el token falla, tampoco rompe el job', async () => {
    const { processor, store } = buildProcessor({
      contact: withPush,
      pushSendError: new PushTokenInvalidError('DeviceNotRegistered'),
      registerPushTokenError: new Error('base caida'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('push con error generico: no limpia el token ni rompe el job', async () => {
    const { processor, registerPushToken, store } = buildProcessor({
      contact: withPush,
      pushSendError: new Error('Expo esta caido'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(registerPushToken).not.toHaveBeenCalled();
    expect(store.markFailed).not.toHaveBeenCalled();
  });
});
