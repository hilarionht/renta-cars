import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { AvailabilitySlot, AvailabilitySlotId } from '@platform/calendar/domain';

export const AVAILABILITY_SLOT_REPOSITORY = Symbol('AvailabilitySlotRepository');

export interface AvailabilitySlotRepository {
  findById(id: AvailabilitySlotId): Promise<AvailabilitySlot | null>;
  save(slot: AvailabilitySlot, tx: UnitOfWorkTransaction): Promise<void>;
}
