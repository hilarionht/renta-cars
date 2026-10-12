import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Charge as PrismaCharge, Invoice as PrismaInvoice } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  Money,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  Charge,
  Invoice,
  InvoiceAlreadyIssuedError,
  type InvoiceId,
  TaxDetails,
} from '@rental/invoices/domain';
import type { InvoiceRepository } from '@rental/invoices/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

type InvoiceWithCharges = PrismaInvoice & { charges: PrismaCharge[] };

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.invoice.findFirst({ where: { id: id.toString() }, include: { charges: true } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async findByReservationId(reservationId: string): Promise<Invoice | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.invoice.findFirst({
        where: { reservationId, status: { not: 'Voided' } },
        include: { charges: true },
      }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(invoice: Invoice, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);

    if (invoice.isNew) {
      try {
        await prisma.invoice.create({
          data: {
            id: invoice.id.toString(),
            companyId: invoice.companyId,
            reservationId: invoice.reservationId,
            customerId: invoice.customerId,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            taxAmountMinorUnits: invoice.taxDetails.taxAmountMinorUnits,
            version: invoice.version,
            charges: {
              create: invoice.charges.map((charge) => ({
                id: charge.id.toString(),
                companyId: invoice.companyId,
                kind: charge.kind,
                amountMinorUnits: charge.amount.minorUnits,
                currency: charge.amount.currencyCode,
                description: charge.description,
              })),
            },
          },
        });
      } catch (error) {
        throw this.mapUniqueConstraintViolation(error, invoice);
      }
      invoice.markPersisted();
    } else {
      const result = await prisma.invoice.updateMany({
        where: { id: invoice.id.toString(), version: invoice.version - 1 },
        data: {
          status: invoice.status,
          voidReason: invoice.voidReason ?? null,
          version: invoice.version,
        },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('Invoice', invoice.id.toString());
      }
    }
  }

  private mapUniqueConstraintViolation(error: unknown, invoice: Invoice): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      const driverMessage = this.extractDriverErrorMessage(error);
      if (driverMessage.includes('invoices_reservation_id_active_key')) {
        return new InvoiceAlreadyIssuedError(invoice.reservationId);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private extractDriverErrorMessage(error: Prisma.PrismaClientKnownRequestError): string {
    const driverAdapterError = error.meta?.['driverAdapterError'];
    if (driverAdapterError && typeof driverAdapterError === 'object') {
      const cause = (driverAdapterError as { cause?: unknown }).cause;
      if (cause && typeof cause === 'object') {
        const originalMessage = (cause as { originalMessage?: unknown }).originalMessage;
        if (typeof originalMessage === 'string') {
          return originalMessage;
        }
      }
    }
    return error.message;
  }

  private toDomain(record: InvoiceWithCharges): Invoice {
    return Invoice.reconstitute(
      {
        id: EntityId.from<'Invoice'>(record.id),
        companyId: record.companyId,
        reservationId: record.reservationId,
        customerId: record.customerId,
        invoiceNumber: record.invoiceNumber,
        status: record.status,
        taxDetails: TaxDetails.from(record.taxAmountMinorUnits),
        voidReason: record.voidReason ?? undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      },
      record.charges.map((charge) =>
        Charge.reconstitute({
          id: EntityId.from<'Charge'>(charge.id),
          kind: charge.kind,
          amount: Money.from(charge.amountMinorUnits, charge.currency),
          description: charge.description,
          createdAt: charge.createdAt,
        }),
      ),
    );
  }
}
