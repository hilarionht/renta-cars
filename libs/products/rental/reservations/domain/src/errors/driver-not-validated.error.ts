import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - DRIVER_NOT_VALIDATED (422, INV-105/RN-09).
export class DriverNotValidatedError extends DomainError {
  constructor(reservationId: string) {
    super(
      `La reservation "${reservationId}" tiene un additional driver declarado que no esta Validated.`,
    );
  }
}
