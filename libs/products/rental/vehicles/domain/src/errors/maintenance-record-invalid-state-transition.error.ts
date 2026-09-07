import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS5.2: transiciones explicitamente invalidas de
// MaintenanceRecord (p. ej. Scheduled -> complete() directo, salta InProgress).
export class MaintenanceRecordInvalidStateTransitionError extends DomainError {
  constructor(maintenanceId: string, from: string, action: string) {
    super(
      `El maintenance record "${maintenanceId}" no puede "${action}" estando en estado "${from}".`,
    );
  }
}
