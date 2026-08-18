import { DomainError } from '@platform/shared-kernel';

export class VehicleCategoryNotFoundError extends DomainError {
  constructor(vehicleCategoryId: string) {
    super(`No existe la vehicle category "${vehicleCategoryId}".`);
  }
}
