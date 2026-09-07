import { DomainError } from '@platform/shared-kernel';

export class ReservationNotFoundError extends DomainError {
  constructor(reservationId: string) {
    super(`No existe la reservation "${reservationId}".`);
  }
}
