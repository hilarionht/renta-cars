import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetInvoiceQuery, InvoiceSummary } from '@rental/invoices/application';
import { InvoiceNotFoundError } from '@rental/invoices/domain';

@Injectable()
export class GetInvoiceHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetInvoiceQuery): Promise<InvoiceSummary> {
    const record = await this.readTransaction.run(
      (tx) => tx.invoice.findFirst({ where: { id: query.invoiceId }, include: { charges: true } }),
      query.companyId,
    );

    if (!record) {
      throw new InvoiceNotFoundError(query.invoiceId);
    }

    const currency = record.charges[0]?.currency ?? 'USD';
    const totalMinorUnits = record.charges.reduce(
      (sum, charge) => sum + charge.amountMinorUnits,
      0,
    );

    return {
      id: record.id,
      reservationId: record.reservationId,
      customerId: record.customerId,
      invoiceNumber: record.invoiceNumber,
      status: record.status,
      taxAmountMinorUnits: record.taxAmountMinorUnits,
      totalMinorUnits,
      currency,
      voidReason: record.voidReason ?? undefined,
      charges: record.charges.map((charge) => ({
        id: charge.id,
        kind: charge.kind,
        amountMinorUnits: charge.amountMinorUnits,
        currency: charge.currency,
        description: charge.description,
      })),
    };
  }
}
