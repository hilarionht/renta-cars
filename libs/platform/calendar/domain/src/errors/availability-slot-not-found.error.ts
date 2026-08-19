import { DomainError } from '@platform/shared-kernel';

export class AvailabilitySlotNotFoundError extends DomainError {
  constructor(slotId: string) {
    super(`No existe el availability slot "${slotId}".`);
  }
}
