import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { InvoiceAlreadyIssuedError, type Invoice } from '@rental/invoices/domain';

import { IssueInvoiceHandler } from './issue-invoice.handler';
import type { InvoiceNumberGeneratorPort } from '../../ports/invoice-number-generator.port';
import type { InvoiceRepository } from '../../ports/invoice.repository';

function buildHandler(existing: Invoice | null = null) {
  const savedInvoices: Invoice[] = [];
  const invoiceRepository: InvoiceRepository = {
    findById: jest.fn(),
    findByReservationId: jest.fn().mockResolvedValue(existing),
    save: jest.fn((invoice: Invoice) => {
      savedInvoices.push(invoice);
      return Promise.resolve();
    }),
  };
  const numberGenerator: InvoiceNumberGeneratorPort = {
    nextNumber: jest.fn().mockResolvedValue('INV-00000001'),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new IssueInvoiceHandler(
    invoiceRepository,
    numberGenerator,
    unitOfWork,
    eventPublisher,
  );

  return { handler, invoiceRepository, eventPublisher, savedInvoices };
}

describe('IssueInvoiceHandler', () => {
  it('emite la invoice, la persiste y publica InvoiceIssued.v1', async () => {
    const { handler, invoiceRepository, eventPublisher, savedInvoices } = buildHandler();

    const invoiceId = await handler.execute({
      companyId: 'company-1',
      reservationId: 'reservation-1',
      customerId: 'customer-1',
      charges: [
        { kind: 'RentalFee', amountMinorUnits: 150000, currency: 'USD', description: 'Renta base' },
        { kind: 'Penalty', amountMinorUnits: 2500, currency: 'USD', description: 'dano' },
      ],
    });

    expect(invoiceId.toString()).toBeDefined();
    expect(invoiceRepository.save).toHaveBeenCalledTimes(1);
    expect(savedInvoices[0].status).toBe('Issued');
    expect(savedInvoices[0].invoiceNumber).toBe('INV-00000001');
    expect(savedInvoices[0].total.minorUnits).toBe(152500);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'InvoiceIssued.v1', aggregateType: 'Invoice' }),
    );
  });

  it('lanza InvoiceAlreadyIssuedError si ya existe una invoice activa para la reservation', async () => {
    const existing = { id: 'existing' } as unknown as Invoice;
    const { handler } = buildHandler(existing);

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: 'reservation-1',
        customerId: 'customer-1',
        charges: [
          {
            kind: 'RentalFee',
            amountMinorUnits: 150000,
            currency: 'USD',
            description: 'Renta base',
          },
        ],
      }),
    ).rejects.toThrow(InvoiceAlreadyIssuedError);
  });
});
