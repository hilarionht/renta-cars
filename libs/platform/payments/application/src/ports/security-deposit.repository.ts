import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { SecurityDeposit, SecurityDepositId } from '@platform/payments/domain';

export const SECURITY_DEPOSIT_REPOSITORY = Symbol('SecurityDepositRepository');

export interface SecurityDepositRepository {
  // companyId opcional en ambos finders: Release/RetainSecurityDepositHandler corren tanto
  // desde un endpoint HTTP autenticado (RequestContext poblado) como desde
  // SecurityDepositResolveListener, disparado por un evento de dominio via EventEmitter2 en
  // modo fire-and-forget (OutboxWriter usa emit(), nunca emitAsync() - docs/technical/
  // 05-EVENTING.md) - la propagacion de RequestContext (CLS) a traves de esa continuacion
  // async detached no esta garantizada, asi que el listener siempre pasa el companyId
  // explicito del propio evento, mismo mecanismo que UnitOfWork.run()/ReadTransaction.run().
  findById(id: SecurityDepositId, companyId?: string): Promise<SecurityDeposit | null>;
  // Usado por SecurityDepositResolveListener para localizar el deposit Held de la reserva sin
  // conocer su id - UNIQUE(company_id, reservation_id) garantiza a lo sumo uno.
  findByReservationId(reservationId: string, companyId?: string): Promise<SecurityDeposit | null>;
  save(deposit: SecurityDeposit, tx: UnitOfWorkTransaction): Promise<void>;
}
