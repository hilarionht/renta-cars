import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Session, SessionId } from '@platform/identity/domain';

export const SESSION_REPOSITORY = Symbol('SessionRepository');

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  findByRefreshTokenHash(hash: string): Promise<Session | null>;
  findActiveForUser(userId: string): Promise<Session[]>;
  save(session: Session, tx: UnitOfWorkTransaction): Promise<void>;
}
