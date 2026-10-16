import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { AvailabilitySlot, AvailabilitySlotId } from '@platform/calendar/domain';

export const AVAILABILITY_SLOT_REPOSITORY = Symbol('AvailabilitySlotRepository');

export interface AvailabilitySlotRepository {
  // tx (#141): leer dentro de la transaccion del que llama (sin segunda conexion).
  findById(id: AvailabilitySlotId, tx?: UnitOfWorkTransaction): Promise<AvailabilitySlot | null>;
  save(slot: AvailabilitySlot, tx: UnitOfWorkTransaction): Promise<void>;
}
