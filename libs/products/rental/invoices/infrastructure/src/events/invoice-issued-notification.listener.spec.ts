import type { DomainEventEmitted } from '@platform/shared-kernel';
import type { SendNotificationHandler } from '@platform/notifications/application';
import type { CustomerLookupPort } from '@rental/customers/application';

import { InvoiceIssuedNotificationListener } from './invoice-issued-notification.listener';

function buildEvent(overrides?: Partial<DomainEventEmitted>): DomainEventEmitted {
  return {
    eventType: 'InvoiceIssued.v1',
    aggregateType: 'Invoice',
    aggregateId: 'invoice-1',
    companyId: 'company-1',
    payload: {
      invoiceId: 'invoice-1',
      customerId: 'customer-1',
      invoiceNumber: 'INV-00000001',
      total: { minorUnits: 162500, currency: 'MXN' },
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

  const listener = new InvoiceIssuedNotificationListener(customerLookupPort, sendNotification);

  return { listener, customerLookupPort, execute };
}

describe('InvoiceIssuedNotificationListener', () => {
  it('resuelve el contacto y envia el comprobante de pago', async () => {
    const { listener, customerLookupPort, execute } = buildListener();

    await listener.handle(buildEvent());

    expect(customerLookupPort.getContactInfo).toHaveBeenCalledWith('customer-1', 'company-1');
    expect(execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      kind: 'Receipt',
      recipient: { email: 'user@example.com', phone: '+525500000000' },
      templateId: 'invoice-receipt',
      templateParams: {
        customerName: 'Customer 1',
        invoiceNumber: 'INV-00000001',
        totalAmount: '162500',
        currency: 'MXN',
      },
    });
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
