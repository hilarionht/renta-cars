import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { BranchSummary, ListBranchesQuery } from '@platform/branches/application';
import type { DaySchedule } from '@platform/branches/domain';

@Injectable()
export class ListBranchesHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListBranchesQuery): Promise<BranchSummary[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.branch.findMany({ where: { companyId: query.companyId } }),
      query.companyId,
    );

    return records.map((record) => ({
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
    }));
  }
}
