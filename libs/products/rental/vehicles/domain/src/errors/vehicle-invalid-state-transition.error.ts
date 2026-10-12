import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS2.2: transiciones explicitamente invalidas de Vehicle.
export class VehicleInvalidStateTransitionError extends DomainError {
  constructor(vehicleId: string, from: string, action: string) {
    super(`El vehicle "${vehicleId}" no puede "${action}" estando en estado "${from}".`);
  }
}
