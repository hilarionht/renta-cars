import { DomainError } from '@platform/shared-kernel';

// INV-012 (docs/model/07-INVARIANTS.md): un AdditionalDriver no puede quedar Validated sin
// una licencia de conducir vigente propia (RN-09).
export class AdditionalDriverMissingValidLicenseError extends DomainError {
  constructor(driverId: string) {
    super(`El additional driver "${driverId}" no tiene una licencia de conducir vigente.`);
  }
}
