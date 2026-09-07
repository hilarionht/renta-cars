import { DomainError } from '@platform/shared-kernel';

// Defensivo - no deberia ocurrir nunca en la practica, dado que CompanySettings se crea
// siempre junto con Company en la misma transaccion (docs/persistence/07-MIGRACIONES.md SS5.2).
export class CompanySettingsNotFoundError extends DomainError {
  constructor(companyId: string) {
    super(`No existe CompanySettings para la company "${companyId}".`);
  }
}
