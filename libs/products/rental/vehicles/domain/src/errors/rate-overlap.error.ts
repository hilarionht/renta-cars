import { DomainError } from '@platform/shared-kernel';

// INV-010 (docs/model/07-INVARIANTS.md, RN-20): dos Rate de la misma VehicleCategory no
// pueden tener vigencias solapadas.
export class RateOverlapError extends DomainError {
  constructor(vehicleCategoryId: string) {
    super(
      `La vigencia de la nueva rate se solapa con otra ya existente en la categoria "${vehicleCategoryId}".`,
    );
  }
}
