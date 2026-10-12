import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS1.3: transiciones explicitamente invalidas de Reservation.
export class ReservationInvalidStateTransitionError extends DomainError {
  constructor(reservationId: string, from: string, action: string) {
    super(`La reservation "${reservationId}" no puede "${action}" estando en estado "${from}".`);
  }
}
