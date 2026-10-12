import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - EXTENSION_COLLIDES (409, INV-106/RN-30) - una
// extension solicitada colisiona con otra Reservation confirmada, sin swapVehicle().
export class ExtensionCollidesError extends DomainError {
  constructor(reservationId: string) {
    super(
      `La extension solicitada para la reservation "${reservationId}" colisiona con otra reservation confirmada - requiere swapVehicle() o rechazo explicito.`,
    );
  }
}
