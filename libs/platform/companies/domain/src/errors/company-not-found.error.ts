import { DomainError } from '@platform/shared-kernel';

// Copia propia del modulo (no reutiliza la de platform-users/domain) - aislamiento de
// dominio entre modulos, docs/05-CONVENCIONES-BACKEND.md SS3.
export class CompanyNotFoundError extends DomainError {
  constructor(companyId: string) {
    super(`No existe la company "${companyId}".`);
  }
}
