import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { SecurityDeposit, SecurityDepositId } from '@platform/payments/domain';

export const SECURITY_DEPOSIT_REPOSITORY = Symbol('SecurityDepositRepository');

export interface SecurityDepositRepository {
  findById(id: SecurityDepositId): Promise<SecurityDeposit | null>;
  // Usado por SecurityDepositResolveListener (reacciona a ReservationCheckedIn.v1) para
  // localizar el deposit Held de la reserva sin conocer su id - UNIQUE(company_id,
  // reservation_id) garantiza a lo sumo uno.
  findByReservationId(reservationId: string): Promise<SecurityDeposit | null>;
  save(deposit: SecurityDeposit, tx: UnitOfWorkTransaction): Promise<void>;
}
