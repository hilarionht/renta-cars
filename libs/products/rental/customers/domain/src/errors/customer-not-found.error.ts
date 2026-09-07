import { DomainError } from '@platform/shared-kernel';

export class CustomerNotFoundError extends DomainError {
  constructor(customerId: string) {
    super(`No existe el customer "${customerId}".`);
  }
}
