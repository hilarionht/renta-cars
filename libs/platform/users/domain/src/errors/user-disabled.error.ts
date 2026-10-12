import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md SS3: USER_DISABLED (403) - intento de autenticar (o de
// operar) un User en estado Disabled.
export class UserDisabledError extends DomainError {
  constructor(userId: string) {
    super(`El usuario "${userId}" esta deshabilitado.`);
  }
}
