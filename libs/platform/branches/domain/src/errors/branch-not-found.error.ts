import { DomainError } from '@platform/shared-kernel';

export class BranchNotFoundError extends DomainError {
  constructor(branchId: string) {
    super(`No existe la sucursal "${branchId}".`);
  }
}
