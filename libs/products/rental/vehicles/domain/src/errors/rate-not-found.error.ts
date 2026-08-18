import { DomainError } from '@platform/shared-kernel';

export class RateNotFoundError extends DomainError {
  constructor(rateId: string) {
    super(`No existe la rate "${rateId}".`);
  }
}
