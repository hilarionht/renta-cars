import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Session, SessionId } from '@platform/identity/domain';

export const SESSION_REPOSITORY = Symbol('SessionRepository');

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  // Sin companyId - se resuelve ANTES de saber a que tenant pertenece la sesion (login/
  // refresh no tienen JWT todavia). Ver migration 20260815050000_sessions_lookup_by_hash_rls.
  findByRefreshTokenHash(hash: string): Promise<Session | null>;
  findActiveForUser(userId: string, companyId: string): Promise<Session[]>;
  save(session: Session, tx: UnitOfWorkTransaction): Promise<void>;
}
