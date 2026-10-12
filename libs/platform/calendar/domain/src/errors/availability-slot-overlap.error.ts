import { DomainError } from '@platform/shared-kernel';

// INV-013/INV-102 (docs/model/07-INVARIANTS.md): dos AvailabilitySlot Active del mismo
// ResourceRef no pueden solaparse en su DateRange.
export class AvailabilitySlotOverlapError extends DomainError {
  constructor(resourceType: string, resourceId: string) {
    super(
      `El rango solicitado se solapa con un slot activo existente para "${resourceType}:${resourceId}".`,
    );
  }
}
