import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { InvalidReportRangeError } from '@rental/reports/application';
import type {
  CustomerActivityItem,
  CustomerActivityQuery,
  CustomerActivityResult,
  CustomerActivitySpend,
} from '@rental/reports/application';

const DEFAULT_LIMIT = 20;

@Injectable()
export class CustomerActivityHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: CustomerActivityQuery): Promise<CustomerActivityResult> {
    if (query.from > query.to) {
      throw new InvalidReportRangeError(query.from, query.to);
    }
    const from = new Date(query.from);
    const to = new Date(query.to);

    const { reservationCounts, charges } = await this.readTransaction.run(async (tx) => {
      const reservationGroups = await tx.reservation.groupBy({
        by: ['customerId'],
        where: { createdAt: { gte: from, lte: to } },
        _count: true,
      });
      const chargeRecords = await tx.charge.findMany({
        where: { invoice: { status: 'Issued', createdAt: { gte: from, lte: to } } },
        select: {
          amountMinorUnits: true,
          currency: true,
          invoice: { select: { customerId: true } },
        },
      });
      return { reservationCounts: reservationGroups, charges: chargeRecords };
    }, query.companyId);

    // (customerId, currency) - mismo criterio que revenue-by-branch: Charge.currency es un
    // string libre, sin constraint que impida montos mixtos por customer.
    const spendByCustomer = new Map<string, Map<string, number>>();
    for (const charge of charges) {
      const customerId = charge.invoice.customerId;
      const byCurrency = spendByCustomer.get(customerId) ?? new Map<string, number>();
      byCurrency.set(
        charge.currency,
        (byCurrency.get(charge.currency) ?? 0) + charge.amountMinorUnits,
      );
      spendByCustomer.set(customerId, byCurrency);
    }

    const reservationCountByCustomer = new Map(
      reservationCounts.map((group) => [group.customerId, group._count]),
    );

    const customerIds = new Set<string>([
      ...reservationCountByCustomer.keys(),
      ...spendByCustomer.keys(),
    ]);
    if (customerIds.size === 0) {
      return { items: [] };
    }

    const customers = await this.readTransaction.run(
      (tx) =>
        tx.customer.findMany({
          where: { id: { in: Array.from(customerIds) } },
          select: { id: true, name: true },
        }),
      query.companyId,
    );
    const nameByCustomer = new Map(customers.map((customer) => [customer.id, customer.name]));

    const items: CustomerActivityItem[] = Array.from(customerIds).map((customerId) => {
      const spendMap = spendByCustomer.get(customerId);
      const spend: CustomerActivitySpend[] = spendMap
        ? Array.from(spendMap.entries()).map(([currency, amountMinorUnits]) => ({
            currency,
            amountMinorUnits,
          }))
        : [];
      return {
        customerId,
        customerName: nameByCustomer.get(customerId) ?? customerId,
        reservationCount: reservationCountByCustomer.get(customerId) ?? 0,
        spend,
      };
    });

    items.sort((a, b) => totalSpend(b.spend) - totalSpend(a.spend));

    return { items: items.slice(0, query.limit ?? DEFAULT_LIMIT) };
  }
}

// Suma cruda entre monedas SOLO para ordenar (nunca se expone este numero al cliente - el
// campo `spend` que se retorna sigue separado por currency, sin aplanar).
function totalSpend(spend: CustomerActivitySpend[]): number {
  return spend.reduce((sum, entry) => sum + entry.amountMinorUnits, 0);
}
