import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - BRANCH_CLOSED (409, INV-112) - checkOut()/checkIn()
// sobre una Branch cerrada.
export class BranchClosedError extends DomainError {
  constructor(branchId: string) {
    super(`La branch "${branchId}" esta Closed - no admite checkOut()/checkIn().`);
  }
}
