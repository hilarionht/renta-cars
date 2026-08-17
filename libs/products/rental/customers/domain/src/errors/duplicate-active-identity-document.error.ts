import { DomainError } from '@platform/shared-kernel';

// docs/persistence/05-INDICES-Y-CONSTRAINTS.md: indice unico parcial (owner, document_type)
// WHERE status IN ('Pending','Verified') - un propietario no puede tener 2 documentos
// activos del mismo tipo simultaneamente. Se detecta atrapando el constraint de Postgres
// (P2002), no con un pre-check - mismo patron que DuplicateTaxIdError.
export class DuplicateActiveIdentityDocumentError extends DomainError {
  constructor(documentType: string) {
    super(`Ya existe un documento activo de tipo "${documentType}" para este propietario.`);
  }
}
