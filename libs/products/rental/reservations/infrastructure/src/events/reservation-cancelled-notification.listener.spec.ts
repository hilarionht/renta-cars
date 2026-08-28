import type { DomainEventEmitted } from '@platform/shared-kernel';
import type { SendNotificationHandler } from '@platform/notifications/application';
import type { CustomerLookupPort } from '@rental/customers/application';

import { ReservationCancelledNotificationListener } from './reservation-cancelled-notification.listener';

function buildEvent(overrides?: Partial<DomainEventEmitted>): DomainEventEmitted {
  return {
    eventType: 'ReservationCancelled.v1',
    aggregateType: 'Reservation',
    aggregateId: 'reservation-1',
    companyId: 'company-1',
    payload: {
      reservationId: 'reservation-1',
      customerId: 'customer-1',
      cancelledBy: 'customer-1',
    },
    occurredAt: new Date(),
    ...overrides,
  };
}

function buildListener() {
  const customerLookupPort: CustomerLookupPort = {
    isEligibleForConfirmation: jest.fn(),
    areAdditionalDriversValidated: jest.fn(),
    getContactInfo: jest
      .fn()
      .mockResolvedValue({ email: 'user@example.com', phone: '+525500000000', name: 'Customer 1' }),
  };
  const execute = jest.fn().mockResolvedValue({ toString: () => 'notification-1' });
  const sendNotification = { execute } as unknown as SendNotificationHandler;

  const listener = new ReservationCancelledNotificationListener(
    customerLookupPort,
    sendNotification,
  );

  return { listener, customerLookupPort, execute };
}

describe('ReservationCancelledNotificationListener', () => {
  it('resuelve el contacto y envia la notificacion de cancelacion', async () => {
    const { listener, customerLookupPort, execute } = buildListener();

    await listener.handle(buildEvent());

    expect(customerLookupPort.getContactInfo).toHaveBeenCalledWith('customer-1', 'company-1');
    expect(execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      kind: 'Cancellation',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'reservation-cancelled',
      templateParams: {
        customerName: 'Customer 1',
        reservationId: 'reservation-1',
      },
    });
  });

  it('incluye penaltyApplied serializado cuando el evento trae una penalidad', async () => {
    const { listener, execute } = buildListener();

    await listener.handle(
      buildEvent({
        payload: {
          reservationId: 'reservation-1',
          customerId: 'customer-1',
          cancelledBy: 'customer-1',
          penaltyApplied: { kind: 'CancellationPenalty', amountMinorUnits: 500, currency: 'USD' },
        },
      }),
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        templateParams: expect.objectContaining({
          penaltyApplied: JSON.stringify({
            kind: 'CancellationPenalty',
            amountMinorUnits: 500,
            currency: 'USD',
          }),
        }),
      }),
    );
  });

  it('no hace nada si el evento no trae companyId', async () => {
    const { listener, customerLookupPort, execute } = buildListener();

    await listener.handle(buildEvent({ companyId: null }));

    expect(customerLookupPort.getContactInfo).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('no envia nada si el customer no existe (getContactInfo devuelve null)', async () => {
    const { listener, customerLookupPort, execute } = buildListener();
    (customerLookupPort.getContactInfo as jest.Mock).mockResolvedValue(null);

    await expect(listener.handle(buildEvent())).resolves.toBeUndefined();

    expect(execute).not.toHaveBeenCalled();
  });

  it('nunca lanza si SendNotificationHandler falla (fire-and-forget)', async () => {
    const { listener, execute } = buildListener();
    execute.mockRejectedValue(new Error('proveedor caido'));

    await expect(listener.handle(buildEvent())).resolves.toBeUndefined();
  });
});
