import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { User, UserId } from '@platform/users/domain';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  // companyId opcional - la mayoria de los callers corren en rutas autenticadas
  // (RequestContext ya poblado), pero ResetPasswordHandler (recuperacion de contraseña,
  // docs/persistence/10-DECISIONES.md #113) corre en una ruta @Public() y ya conoce el
  // companyId por otra via (el PasswordResetChallenge ya encontrado) - mismo mecanismo que
  // ReadTransaction.run()/CustomerRepository.findById(id, companyId?).
  findById(id: UserId, companyId?: string): Promise<User | null>;
  findByCompanyAndEmail(companyId: string, email: string): Promise<User | null>;
  save(user: User, tx: UnitOfWorkTransaction): Promise<void>;
}
