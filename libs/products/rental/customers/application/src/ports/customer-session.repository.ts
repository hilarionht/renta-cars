import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { CustomerSession, CustomerSessionId } from '@rental/customers/domain';

// Espejo deliberado de platform/identity/application/src/ports/session.repository.ts - ver
// customer-session.ts para la razon de la duplicacion.
export const CUSTOMER_SESSION_REPOSITORY = Symbol('CustomerSessionRepository');

export interface CustomerSessionRepository {
  findById(id: CustomerSessionId): Promise<CustomerSession | null>;
  // Sin companyId - se resuelve ANTES de saber a que tenant pertenece la sesion (verify-otp/
  // refresh no tienen JWT todavia). Bypass de RLS via GUC app.customer_session_lookup_by_hash
  // (distinta de app.session_lookup_by_hash de identity - 2 fronteras de seguridad aisladas).
  findByRefreshTokenHash(hash: string): Promise<CustomerSession | null>;
  findActiveForCustomer(customerId: string, companyId: string): Promise<CustomerSession[]>;
  save(session: CustomerSession, tx: UnitOfWorkTransaction): Promise<void>;
}
