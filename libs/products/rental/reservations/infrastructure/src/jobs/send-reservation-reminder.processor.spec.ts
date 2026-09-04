import { Prisma } from '@prisma/client';

import type { SendNotificationHandler } from '@platform/notifications/application';
import type { UnitOfWork } from '@platform/shared-kernel';
import type { CustomerLookupPort } from '@rental/customers/application';

import { SendReservationReminderProcessor } from './send-reservation-reminder.processor';

function buildJob(): Parameters<SendReservationReminderProcessor['process']>[0] {
  return {
    data: { reservationId: 'reservation-1', companyId: 'company-1', customerId: 'customer-1' },
  } as unknown as Parameters<SendReservationReminderProcessor['process']>[0];
}

function buildProcessor(options: {
  createRejectsWithDuplicate?: boolean;
  contact?: { email: string; phone: string; name: string } | null;
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

  const processor = new SendReservationReminderProcessor(
    unitOfWork,
    customerLookupPort,
    sendNotification,
  );

  return { processor, unitOfWork, customerLookupPort, execute, create };
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
    const { processor, execute } = buildProcessor({ createRejectsWithDuplicate: true });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
  });

  it('no envia nada si el customer no existe (getContactInfo devuelve null)', async () => {
    const { processor, execute } = buildProcessor({ contact: null });

    await processor.process(buildJob());

    expect(execute).not.toHaveBeenCalled();
  });
});
