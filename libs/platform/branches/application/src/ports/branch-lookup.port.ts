import type { UnitOfWorkTransaction } from '@platform/shared-kernel';

// Puerto publico para futuros consumidores cross-modulo (Rental Operations: INV-112,
// Reservation.checkOut() necesita saber si la Branch del Vehicle esta Closed) - sin
// consumidor real todavia, docs/model/07-INVARIANTS.md §2.
export const BRANCH_LOOKUP_PORT = Symbol('BranchLookupPort');

export interface BranchLookupPort {
  // tx (#141): leer dentro de la transaccion del que llama (con el lock de la sucursal).
  getStatus(branchId: string, tx?: UnitOfWorkTransaction): Promise<'Active' | 'Closed' | null>;
}
