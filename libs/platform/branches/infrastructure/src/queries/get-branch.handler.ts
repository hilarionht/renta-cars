import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { BranchSummary, GetBranchQuery } from '@platform/branches/application';
import { BranchNotFoundError, type DaySchedule } from '@platform/branches/domain';

@Injectable()
export class GetBranchHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetBranchQuery): Promise<BranchSummary> {
    return this.readTransaction.run(async (tx) => {
      const record = await tx.branch.findFirst({
        where: { id: query.branchId, companyId: query.companyId },
      });

      if (!record) {
        throw new BranchNotFoundError(query.branchId);
      }

      return {
        id: record.id,
        name: record.name,
        address: {
          line1: record.addressLine1,
          line2: record.addressLine2 ?? undefined,
          city: record.addressCity,
          stateProvince: record.addressStateProvince ?? undefined,
          postalCode: record.addressPostalCode ?? undefined,
          country: record.addressCountry,
        },
        operatingHours: record.operatingHours as unknown as DaySchedule[],
        status: record.status,
      };
    });
  }
}
