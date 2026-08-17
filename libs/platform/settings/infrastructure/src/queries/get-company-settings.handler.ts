import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  CompanySettingsSummary,
  GetCompanySettingsQuery,
} from '@platform/settings/application';
import { CompanySettingsNotFoundError } from '@platform/settings/domain';

@Injectable()
export class GetCompanySettingsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetCompanySettingsQuery): Promise<CompanySettingsSummary> {
    return this.readTransaction.run(async (tx) => {
      const record = await tx.companySettings.findFirst({ where: { companyId: query.companyId } });

      if (!record) {
        throw new CompanySettingsNotFoundError(query.companyId);
      }

      return {
        companyId: record.companyId,
        enabledProductModules: record.enabledProductModules,
        paymentMethodsEnabled: record.paymentMethodsEnabled,
      };
    });
  }
}
