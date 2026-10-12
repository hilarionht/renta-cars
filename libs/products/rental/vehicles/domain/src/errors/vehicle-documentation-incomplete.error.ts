import { DomainError } from '@platform/shared-kernel';

// INV-007 (docs/model/07-INVARIANTS.md, RN-27): un Vehicle no puede pasar a Available sin
// al menos un VehicleDocument Verified.
export class VehicleDocumentationIncompleteError extends DomainError {
  constructor(vehicleId: string) {
    super(`El vehicle "${vehicleId}" no tiene documentacion verificada, no puede habilitarse.`);
  }
}
