import { DomainError } from '@platform/shared-kernel';

// docs/persistence/05-INDICES-Y-CONSTRAINTS.md: indices unicos parciales (vehicle_id,
// document_type) WHERE status = 'Pending' y WHERE status = 'Verified' - desde
// docs/persistence/10-DECISIONES.md #139 solo en una carrera, mismo patron que
// DuplicateActiveIdentityDocumentError en Customers.
export class DuplicateActiveVehicleDocumentError extends DomainError {
  constructor(documentType: string) {
    super(`Ya existe un documento activo de tipo "${documentType}" para este vehicle.`);
  }
}
