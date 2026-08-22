import { Money } from '@platform/shared-kernel';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { Invoice, InvoiceNotFoundError, InvoiceNumber, TaxDetails } from '@rental/invoices/domain';

import { VoidInvoiceHandler } from './void-invoice.handler';
import type { InvoiceRepository } from '../../ports/invoice.repository';

function issuedInvoice(): Invoice {
  return Invoice.issue({
    companyId: 'company-1',
    reservationId: 'reservation-1',
    customerId: 'customer-1',
    invoiceNumber: InvoiceNumber.fromSequence(1),
    taxDetails: TaxDetails.zero(),
    charges: [{ kind: 'RentalFee', amount: Money.from(150000, 'USD'), description: 'Renta base' }],
  });
}

function buildHandler(invoice: Invoice) {
  const invoiceRepository: InvoiceRepository = {
    findById: jest.fn((id) =>
      Promise.resolve(id.toString() === invoice.id.toString() ? invoice : null),
    ),
    findByReservationId: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new VoidInvoiceHandler(invoiceRepository, unitOfWork, eventPublisher);

  return { handler };
}

describe('VoidInvoiceHandler', () => {
  it('anula la invoice y publica InvoiceVoided.v1', async () => {
    const invoice = issuedInvoice();
    const { handler } = buildHandler(invoice);

    await handler.execute({
      companyId: 'company-1',
      invoiceId: invoice.id.toString(),
      reason: 'error de tipificacion fiscal',
    });

    expect(invoice.status).toBe('Voided');
    expect(invoice.voidReason).toBe('error de tipificacion fiscal');
  });

  it('lanza InvoiceNotFoundError si no existe o pertenece a otra company', async () => {
    const invoice = issuedInvoice();
    const { handler } = buildHandler(invoice);

    await expect(
      handler.execute({
        companyId: 'other-company',
        invoiceId: invoice.id.toString(),
        reason: 'x',
      }),
    ).rejects.toThrow(InvoiceNotFoundError);
  });
});
