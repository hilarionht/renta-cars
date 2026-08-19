import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - RESERVATION_OVERLAP (409, INV-102/RN-02) - distinto
// de VehicleNotAvailableError: este se lanza cuando el AvailabilityService.isAvailable()
// pre-check paso pero CalendarPort.occupy() igual fue rechazado por la exclusion constraint
// (perdio la carrera entre cotizar y confirmar, docs/domain/03-PROCESOS.md SS3).
export class ReservationOverlapError extends DomainError {
  constructor(vehicleId: string) {
    super(
      `El vehicle "${vehicleId}" ya tiene una reservation activa que se solapa con el rango solicitado.`,
    );
  }
}
