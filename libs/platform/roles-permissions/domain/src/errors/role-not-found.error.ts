import { DomainError } from '@platform/shared-kernel';

export class RoleNotFoundError extends DomainError {
  constructor(roleId: string) {
    super(`No existe el role "${roleId}".`);
  }
}
