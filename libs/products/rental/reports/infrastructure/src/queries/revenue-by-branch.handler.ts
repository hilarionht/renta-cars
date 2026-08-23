import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { InvalidReportRangeError } from '@rental/reports/application';
import type {
  RevenueByBranchItem,
  RevenueByBranchQuery,
  RevenueByBranchResult,
} from '@rental/reports/application';

// "Ingresos" = revenue facturado (Invoice.status='Issued'), no cash cobrado
// (Payment.status='Captured') - docs/persistence/10-DECISIONES.md Fase 4, item 1: Payment no
// tiene columna de branch ni forma de llegar a una sin el mismo join que ya hace falta del
// lado de Invoice, mas un stitching manual encima (Payment.targetId es opaco, sin FK, ni
// siquiera dentro del mismo Postgres). Charge->Invoice->Reservation->Vehicle son relaciones
// Prisma reales dentro del mismo schema "rental" - sin stitching manual aca. Agrupado por
// (branchId, currency), nunca solo por branchId (Charge.currency es un string libre, sin
// constraint que impida montos mixtos).
@Injectable()
export class RevenueByBranchHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: RevenueByBranchQuery): Promise<RevenueByBranchResult> {
    if (query.from > query.to) {
      throw new InvalidReportRangeError(query.from, query.to);
    }

    const charges = await this.readTransaction.run(
      (tx) =>
        tx.charge.findMany({
          where: {
            invoice: {
              status: 'Issued',
              createdAt: { gte: new Date(query.from), lte: new Date(query.to) },
            },
          },
          select: {
            amountMinorUnits: true,
            currency: true,
            invoice: {
              select: { reservation: { select: { vehicle: { select: { branchId: true } } } } },
            },
          },
        }),
      query.companyId,
    );

    const totals = new Map<string, RevenueByBranchItem>();
    for (const charge of charges) {
      const branchId = charge.invoice.reservation.vehicle.branchId;
      const key = `${branchId}:${charge.currency}`;
      const existing = totals.get(key);
      if (existing) {
        existing.billedRevenueMinorUnits += charge.amountMinorUnits;
      } else {
        totals.set(key, {
          branchId,
          currency: charge.currency,
          billedRevenueMinorUnits: charge.amountMinorUnits,
        });
      }
    }

    return { items: Array.from(totals.values()) };
  }
}
