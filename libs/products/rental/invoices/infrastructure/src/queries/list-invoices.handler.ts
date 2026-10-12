import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  InvoiceSummary,
  ListInvoicesQuery,
  ListInvoicesResult,
} from '@rental/invoices/application';

@Injectable()
export class ListInvoicesHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListInvoicesQuery): Promise<ListInvoicesResult> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.invoice.findMany({
          where: { reservationId: query.reservationId },
          include: { charges: true },
          orderBy: { createdAt: 'desc' },
        }),
      query.companyId,
    );

    const items: InvoiceSummary[] = records.map((record) => {
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
    });

    return { items };
  }
}
