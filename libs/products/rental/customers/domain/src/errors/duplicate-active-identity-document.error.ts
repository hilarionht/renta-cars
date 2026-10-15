import { DomainError } from '@platform/shared-kernel';

// docs/persistence/05-INDICES-Y-CONSTRAINTS.md: indices unicos parciales (owner, document_type)
// WHERE status = 'Pending' y WHERE status = 'Verified' - a lo sumo uno de cada por propietario
// y tipo. Desde docs/persistence/10-DECISIONES.md #139 el dominio reemplaza el anterior antes de
// guardar (renovacion), asi que solo se dispara en una carrera. Se detecta atrapando el
// constraint de Postgres (P2002), no con un pre-check - mismo patron que DuplicateTaxIdError.
export class DuplicateActiveIdentityDocumentError extends DomainError {
  constructor(documentType: string) {
    super(`Ya existe un documento activo de tipo "${documentType}" para este propietario.`);
  }
}
