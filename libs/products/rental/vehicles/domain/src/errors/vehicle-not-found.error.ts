import { DomainError } from '@platform/shared-kernel';

export class VehicleNotFoundError extends DomainError {
  constructor(vehicleId: string) {
    super(`No existe el vehicle "${vehicleId}".`);
  }
}
