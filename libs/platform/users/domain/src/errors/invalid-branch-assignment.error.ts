import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140: antes se aceptaba un usuario con una sucursal
// inexistente o cerrada (el id quedaba colgado y su operacion fallaba despues).
export class InvalidBranchAssignmentError extends DomainError {
  constructor(branchId: string, reason: 'not-found' | 'closed') {
    super(
      reason === 'closed'
        ? `La sucursal "${branchId}" esta cerrada.`
        : `La sucursal "${branchId}" no existe.`,
    );
  }
}
