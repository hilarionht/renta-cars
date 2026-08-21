import { DomainError } from '@platform/shared-kernel';

// docs/model/07-INVARIANTS.md - INV-020: SecurityDeposit resuelto (Released/Retained) es
// terminal.
export class SecurityDepositAlreadyResolvedError extends DomainError {
  constructor(securityDepositId: string, status: string) {
    super(`El security deposit "${securityDepositId}" ya esta resuelto (estado "${status}").`);
  }
}
