import { DomainError } from '@platform/shared-kernel';

export class AdditionalDriverRevokedError extends DomainError {
  constructor(driverId: string) {
    super(`El additional driver "${driverId}" esta revocado y no puede validarse.`);
  }
}
