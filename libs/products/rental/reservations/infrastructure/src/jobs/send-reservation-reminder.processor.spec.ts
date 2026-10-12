import { Prisma } from '@prisma/client';

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

import { SendReservationReminderProcessor } from './send-reservation-reminder.processor';

function buildJob(): Parameters<SendReservationReminderProcessor['process']>[0] {
  return {
    data: { reservationId: 'reservation-1', companyId: 'company-1', customerId: 'customer-1' },
  } as unknown as Parameters<SendReservationReminderProcessor['process']>[0];
}

function buildProcessor(options: {
  createRejectsWithDuplicate?: boolean;
  contact?: { email: string; phone: string; name: string; pushDeviceToken?: string } | null;
  pushSendError?: Error;
}) {
  const create = options.createRejectsWithDuplicate
    ? jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
    : jest.fn().mockResolvedValue(undefined);

  const unitOfWork = {
    run: jest.fn((work: (tx: unknown) => unknown) =>
      work({ reservationReminderDispatch: { create } }),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as UnitOfWork;

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

  const execute = jest.fn().mockResolvedValue(undefined);
  const sendNotification = { execute } as unknown as SendNotificationHandler;

  const sendPush = options.pushSendError
    ? jest.fn().mockRejectedValue(options.pushSendError)
    : jest.fn().mockResolvedValue(undefined);
  const sendPushNotification = { execute: sendPush } as unknown as SendPushNotificationHandler;

  const registerPushToken = jest.fn().mockResolvedValue(undefined);
  const registerCustomerPushToken = {
    execute: registerPushToken,
  } as unknown as RegisterCustomerPushTokenHandler;

  const processor = new SendReservationReminderProcessor(
    unitOfWork,
    customerLookupPort,
    sendNotification,
    sendPushNotification,
    registerCustomerPushToken,
  );

  return {
    processor,
    unitOfWork,
    customerLookupPort,
    execute,
    create,
    sendPush,
    registerPushToken,
  };
}

describe('SendReservationReminderProcessor', () => {
  it('primer despacho: registra el dispatch y envia la notificacion', async () => {
    const { processor, execute, create } = buildProcessor({});

    await processor.process(buildJob());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-1', reservationId: 'reservation-1' }),
      }),
    );
    expect(execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      kind: 'Reminder',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'reservation-reminder',
      templateParams: { customerName: 'Customer 1', reservationId: 'reservation-1' },
    });
  });

  it('idempotente: si el dispatch ya existia (P2002), no reenvia', async () => {
    const { processor, execute, sendPush } = buildProcessor({ createRejectsWithDuplicate: true });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('no envia nada si el customer no existe (getContactInfo devuelve null)', async () => {
    const { processor, execute, sendPush } = buildProcessor({ contact: null });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('sin pushDeviceToken: no intenta enviar push', async () => {
    const { processor, sendPush } = buildProcessor({
      contact: { email: 'user@example.com', phone: '+525500000000', name: 'Customer 1' },
    });

    await processor.process(buildJob());

    expect(sendPush).not.toHaveBeenCalled();
  });

  it('con pushDeviceToken: envia el push ademas de la notificacion normal', async () => {
    const { processor, sendPush } = buildProcessor({
      contact: {
        email: 'user@example.com',
        phone: '+525500000000',
        name: 'Customer 1',
        pushDeviceToken: 'ExponentPushToken[abc]',
      },
    });

    await processor.process(buildJob());

    expect(sendPush).toHaveBeenCalledWith({
      deviceToken: 'ExponentPushToken[abc]',
      title: 'Recordatorio de tu reserva',
      body: 'Hola Customer 1, tu reserva esta por comenzar.',
      data: { reservationId: 'reservation-1' },
    });
  });

  it('push con PushTokenInvalidError: limpia el token pero no rompe el job', async () => {
    const { processor, registerPushToken } = buildProcessor({
      contact: {
        email: 'user@example.com',
        phone: '+525500000000',
        name: 'Customer 1',
        pushDeviceToken: 'ExponentPushToken[abc]',
      },
      pushSendError: new PushTokenInvalidError('DeviceNotRegistered'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(registerPushToken).toHaveBeenCalledWith({
      customerId: 'customer-1',
      companyId: 'company-1',
      deviceToken: null,
    });
  });

  it('push con error generico: no limpia el token ni rompe el job', async () => {
    const { processor, registerPushToken } = buildProcessor({
      contact: {
        email: 'user@example.com',
        phone: '+525500000000',
        name: 'Customer 1',
        pushDeviceToken: 'ExponentPushToken[abc]',
      },
      pushSendError: new Error('Expo esta caido'),
    });

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(registerPushToken).not.toHaveBeenCalled();
  });
});
