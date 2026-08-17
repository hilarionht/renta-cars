import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { SettingsLookupPort } from '@platform/settings/application';

// Consumido por apps/api (TenantModuleEnabledGuard) - corre despues de TenantContextGuard,
// que ya poblo RequestContext desde el JWT, asi que ReadTransaction ambiente alcanza.
@Injectable()
export class PrismaSettingsLookupAdapter implements SettingsLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getEnabledProductModules(companyId: string): Promise<string[] | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { enabledProductModules: true },
      }),
    );
    return record?.enabledProductModules ?? null;
  }
}
