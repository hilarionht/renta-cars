import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { User, UserId } from '@platform/users/domain';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByCompanyAndEmail(companyId: string, email: string): Promise<User | null>;
  save(user: User, tx: UnitOfWorkTransaction): Promise<void>;
}
