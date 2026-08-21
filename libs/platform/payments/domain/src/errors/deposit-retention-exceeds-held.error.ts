import { DomainError } from '@platform/shared-kernel';

// docs/model/07-INVARIANTS.md - INV-019: el monto retenido nunca excede el monto
// originalmente retenido.
export class DepositRetentionExceedsHeldError extends DomainError {
  constructor(securityDepositId: string) {
    super(
      `El monto a retener excede el monto originalmente retenido en el security deposit "${securityDepositId}".`,
    );
  }
}
