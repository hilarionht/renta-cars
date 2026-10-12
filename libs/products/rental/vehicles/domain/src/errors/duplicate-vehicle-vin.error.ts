import { DomainError } from '@platform/shared-kernel';

export class DuplicateVehicleVinError extends DomainError {
  constructor(vin: string) {
    super(`Ya existe un vehicle con el VIN "${vin}" en esta company.`);
  }
}
