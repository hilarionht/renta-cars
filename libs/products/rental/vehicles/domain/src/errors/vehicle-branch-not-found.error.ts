import { DomainError } from '@platform/shared-kernel';

// docs/persistence/03-RELACIONES.md: vehicles.branch_id es cross-schema sin FK real - la
// integridad se valida en application/ al crear el Vehicle consultando BRANCH_LOOKUP_PORT.
export class VehicleBranchNotFoundError extends DomainError {
  constructor(branchId: string) {
    super(`No existe la branch "${branchId}".`);
  }
}
