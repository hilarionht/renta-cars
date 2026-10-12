import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - VEHICLE_NOT_AVAILABLE (409, INV-101/RN-01,
// INV-103/RN-04) - el Vehicle no esta disponible (mantenimiento/fuera de servicio, o
// AvailabilityService.isAvailable() ya niega el rango antes de intentar occupy()).
export class VehicleNotAvailableError extends DomainError {
  constructor(vehicleId: string) {
    super(`El vehicle "${vehicleId}" no esta disponible en el rango solicitado.`);
  }
}
