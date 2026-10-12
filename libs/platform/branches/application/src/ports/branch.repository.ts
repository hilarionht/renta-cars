import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Branch, BranchId } from '@platform/branches/domain';

export const BRANCH_REPOSITORY = Symbol('BranchRepository');

export interface BranchRepository {
  findById(id: BranchId): Promise<Branch | null>;
  findAllForCompany(companyId: string): Promise<Branch[]>;
  save(branch: Branch, tx: UnitOfWorkTransaction): Promise<void>;
}
