import { Injectable } from '@nestjs/common';

import { asPrismaTransaction } from '@platform/persistence-kernel';
import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { BranchActiveReservationsPort } from '@platform/branches/application';

// docs/persistence/10-DECISIONES.md #140: implementacion de rental del puerto de branches
// (inversion de dependencias, INV-P03). La reserva no tiene branchId: la sucursal es la del
// vehiculo. Draft no cuenta (no ocupa el vehiculo y expira).
@Injectable()
export class PrismaBranchActiveReservationsAdapter implements BranchActiveReservationsPort {
  // #141: siempre dentro de la transaccion del cierre (con el lock de la sucursal tomado).
  async findActiveReservationIds(
    companyId: string,
    branchId: string,
    tx: UnitOfWorkTransaction,
  ): Promise<string[]> {
    const rows = await asPrismaTransaction(tx).reservation.findMany({
      where: {
        companyId,
        status: { in: ['Confirmed', 'CheckedOut'] },
        vehicle: { branchId },
      },
      select: { id: true },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((row) => row.id);
  }
}
