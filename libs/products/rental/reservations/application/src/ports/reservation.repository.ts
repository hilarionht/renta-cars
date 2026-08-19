import type { Reservation, ReservationId } from '@rental/reservations/domain';
import type { UnitOfWorkTransaction } from '@platform/shared-kernel';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');

export interface ReservationRepository {
  findById(id: ReservationId): Promise<Reservation | null>;
  save(reservation: Reservation, tx: UnitOfWorkTransaction): Promise<void>;
}
