import { InvalidBranchAssignmentError } from '@platform/users/domain';
import type { BranchLookupPort } from '@platform/branches/application';

// docs/persistence/10-DECISIONES.md #140: un usuario solo se asigna a una sucursal que existe y
// esta abierta (alta y edicion). La lectura usa RLS: una sucursal de otra company no existe.
export async function assertBranchAssignable(
  branchLookup: BranchLookupPort,
  branchId: string,
): Promise<void> {
  const status = await branchLookup.getStatus(branchId);
  if (status === null) {
    throw new InvalidBranchAssignmentError(branchId, 'not-found');
  }
  if (status !== 'Active') {
    throw new InvalidBranchAssignmentError(branchId, 'closed');
  }
}
