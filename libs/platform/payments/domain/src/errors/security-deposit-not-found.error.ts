import { DomainError } from '@platform/shared-kernel';

export class SecurityDepositNotFoundError extends DomainError {
  constructor(securityDepositId: string) {
    super(`No existe el security deposit "${securityDepositId}".`);
  }
}
