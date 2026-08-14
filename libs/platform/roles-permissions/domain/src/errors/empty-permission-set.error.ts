import { DomainError } from '@platform/shared-kernel';

// docs/model/02-AGGREGATES.md SS2: el conjunto de permisos de un Role nunca puede quedar
// vacio tras una edicion (reforzado tambien por CHECK a nivel de base, docs/persistence/
// 05-INDICES-Y-CONSTRAINTS.md SS4).
export class EmptyPermissionSetError extends DomainError {
  constructor(roleId: string) {
    super(`El role "${roleId}" no puede quedar sin permisos.`);
  }
}
