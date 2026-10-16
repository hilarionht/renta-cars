import { Injectable } from '@nestjs/common';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import type { BranchLookupPort } from '@platform/branches/application';

@Injectable()
export class PrismaBranchLookupAdapter implements BranchLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getStatus(
    branchId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<'Active' | 'Closed' | null> {
    const query = { where: { id: branchId }, select: { status: true } };
    const record = tx
      ? await asPrismaTransaction(tx).branch.findFirst(query)
      : await this.readTransaction.run((readTx) => readTx.branch.findFirst(query));
    return record?.status ?? null;
  }
}
