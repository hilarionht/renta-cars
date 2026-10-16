import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { BranchActiveReservationsPort } from '@platform/branches/application';

// docs/persistence/10-DECISIONES.md #140: implementacion de rental del puerto de branches
// (inversion de dependencias, INV-P03). La reserva no tiene branchId: la sucursal es la del
// vehiculo. Draft no cuenta (no ocupa el vehiculo y expira).
@Injectable()
export class PrismaBranchActiveReservationsAdapter implements BranchActiveReservationsPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findActiveReservationIds(companyId: string, branchId: string): Promise<string[]> {
    const rows = await this.readTransaction.run(
      (tx) =>
        tx.reservation.findMany({
          where: {
            companyId,
            status: { in: ['Confirmed', 'CheckedOut'] },
            vehicle: { branchId },
          },
          select: { id: true },
          orderBy: { startDate: 'asc' },
        }),
      companyId,
    );
    return rows.map((row) => row.id);
  }
}
