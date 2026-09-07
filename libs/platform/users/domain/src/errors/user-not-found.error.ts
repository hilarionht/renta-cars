import { DomainError } from '@platform/shared-kernel';

export class UserNotFoundError extends DomainError {
  constructor(userId: string) {
    super(`No existe el usuario "${userId}".`);
  }
}
