import { DomainError } from '@platform/shared-kernel';

export class MaintenanceRecordNotFoundError extends DomainError {
  constructor(maintenanceId: string) {
    super(`No existe el maintenance record "${maintenanceId}".`);
  }
}
