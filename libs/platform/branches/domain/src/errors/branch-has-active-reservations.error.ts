import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140 (decision del usuario): cerrar una sucursal con reservas
// Confirmed o CheckedOut se rechaza (su retiro o devolucion fallaria con BRANCH_CLOSED). Los ids
// van en el mensaje (detail): el contrato de errores no admite campos extra, como en #137.
export class BranchHasActiveReservationsError extends DomainError {
  constructor(branchId: string, reservationIds: string[]) {
    super(
      `La sucursal "${branchId}" tiene reservas confirmadas o en curso: ${reservationIds.join(', ')}.`,
    );
  }
}
