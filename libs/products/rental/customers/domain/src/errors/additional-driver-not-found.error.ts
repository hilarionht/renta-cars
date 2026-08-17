import { DomainError } from '@platform/shared-kernel';

export class AdditionalDriverNotFoundError extends DomainError {
  constructor(driverId: string) {
    super(`No existe el additional driver "${driverId}".`);
  }
}
