import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { CompanySummary, GetCompanyQuery } from '@platform/companies/application';
import { CompanyNotFoundError } from '@platform/companies/domain';

@Injectable()
export class GetCompanyHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetCompanyQuery): Promise<CompanySummary> {
    return this.readTransaction.run(async (tx) => {
      const record = await tx.company.findFirst({ where: { id: query.companyId } });

      if (!record) {
        throw new CompanyNotFoundError(query.companyId);
      }

      return {
        id: record.id,
        legalName: record.legalName,
        taxId: record.taxId,
        billingContactEmail: record.billingContactEmail,
        billingContactPhone: record.billingContactPhone ?? undefined,
        status: record.status,
      };
    });
  }
}
