import { DomainError } from '@platform/shared-kernel';

// INV-014 (docs/model/07-INVARIANTS.md SS1): Email unico por CompanyId.
export class DuplicateEmailError extends DomainError {
  constructor(email: string) {
    super(`Ya existe un usuario con el email "${email}" en esta company.`);
  }
}
