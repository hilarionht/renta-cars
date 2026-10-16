import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - BRANCH_CLOSED (409, INV-112) - confirm(), swapVehicle()
// (desde docs/persistence/10-DECISIONES.md #141), checkOut() y checkIn() sobre una Branch cerrada.
export class BranchClosedError extends DomainError {
  constructor(branchId: string) {
    super(`La sucursal "${branchId}" esta cerrada: no admite reservas, retiros ni devoluciones.`);
  }
}
