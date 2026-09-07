import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { BranchLookupPort } from '@platform/branches/application';

@Injectable()
export class PrismaBranchLookupAdapter implements BranchLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getStatus(branchId: string): Promise<'Active' | 'Closed' | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.branch.findFirst({ where: { id: branchId }, select: { status: true } }),
    );
    return record?.status ?? null;
  }
}
