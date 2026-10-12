import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #6, resuelto en la tanda de Vehicles: unico por
// (company_id, license_plate).
export class DuplicateVehicleLicensePlateError extends DomainError {
  constructor(licensePlate: string) {
    super(`Ya existe un vehicle con la placa "${licensePlate}" en esta company.`);
  }
}
