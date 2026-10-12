import { Money } from '@platform/shared-kernel';

import { InvoiceInvalidStateTransitionError } from '../errors/invoice-invalid-state-transition.error';
import type { ChargeKindValue } from '../value-objects/charge-kind';
import { InvoiceNumber } from '../value-objects/invoice-number';
import { TaxDetails } from '../value-objects/tax-details';
import { Invoice } from './invoice';

function issueInvoice(
  charges: { kind: ChargeKindValue; amount: Money; description: string }[] = [
    { kind: 'RentalFee', amount: Money.from(150000, 'USD'), description: 'Renta base' },
  ],
): Invoice {
  return Invoice.issue({
    companyId: 'company-1',
    reservationId: 'reservation-1',
    customerId: 'customer-1',
    invoiceNumber: InvoiceNumber.fromSequence(1),
    taxDetails: TaxDetails.zero(),
    charges,
  });
}

describe('Invoice', () => {
  describe('issue', () => {
    it('crea la invoice Issued, version 1, y emite InvoiceIssued.v1', () => {
      const invoice = issueInvoice();

      expect(invoice.status).toBe('Issued');
      expect(invoice.version).toBe(1);
      expect(invoice.isNew).toBe(true);
      expect(invoice.invoiceNumber).toBe('INV-00000001');
      const events = invoice.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'InvoiceIssued.v1',
        reservationId: 'reservation-1',
        customerId: 'customer-1',
        invoiceNumber: 'INV-00000001',
        total: { minorUnits: 150000, currency: 'USD' },
      });
    });

    it('suma todos los charges en total', () => {
      const invoice = issueInvoice([
        { kind: 'RentalFee', amount: Money.from(150000, 'USD'), description: 'Renta base' },
        { kind: 'Penalty', amount: Money.from(2500, 'USD'), description: 'rayón puerta trasera' },
      ]);

      expect(invoice.total.minorUnits).toBe(152500);
      expect(invoice.charges).toHaveLength(2);
    });

    it('lanza TypeError si no hay ningun charge', () => {
      expect(() =>
        Invoice.issue({
          companyId: 'company-1',
          reservationId: 'reservation-1',
          customerId: 'customer-1',
          invoiceNumber: InvoiceNumber.fromSequence(1),
          taxDetails: TaxDetails.zero(),
          charges: [],
        }),
      ).toThrow(TypeError);
    });
  });

  describe('void', () => {
    it('transiciona Issued -> Voided y emite InvoiceVoided.v1', () => {
      const invoice = issueInvoice();
      invoice.pullDomainEvents();

      invoice.void('error de tipificacion fiscal');

      expect(invoice.status).toBe('Voided');
      expect(invoice.voidReason).toBe('error de tipificacion fiscal');
      expect(invoice.version).toBe(2);
      const events = invoice.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'InvoiceVoided.v1',
        reason: 'error de tipificacion fiscal',
      });
    });

    it('lanza InvoiceInvalidStateTransitionError si ya esta Voided', () => {
      const invoice = issueInvoice();
      invoice.void('primer motivo');

      expect(() => invoice.void('segundo motivo')).toThrow(InvoiceInvalidStateTransitionError);
    });
  });
});
