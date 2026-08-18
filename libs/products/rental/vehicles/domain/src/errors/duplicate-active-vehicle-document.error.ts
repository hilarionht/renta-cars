import { DomainError } from '@platform/shared-kernel';

// docs/persistence/05-INDICES-Y-CONSTRAINTS.md: indice unico parcial (vehicle_id,
// document_type) WHERE status IN ('Pending','Verified') - mismo patron que
// DuplicateActiveIdentityDocumentError en Customers.
export class DuplicateActiveVehicleDocumentError extends DomainError {
  constructor(documentType: string) {
    super(`Ya existe un documento activo de tipo "${documentType}" para este vehicle.`);
  }
}
