import { DomainError } from '@platform/shared-kernel';

// docs/04-MODELO-DATOS.md SS3: sin FK fisica entre schemas, la integridad se valida en
// aplicacion via CompanyExistsPort.
export class CompanyNotFoundError extends DomainError {
  constructor(companyId: string) {
    super(`La company "${companyId}" no existe.`);
  }
}
