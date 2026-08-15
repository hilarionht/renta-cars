import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { CompanyLookupPort } from '@platform/companies/application';

// Consumido por apps/api (CompanyStatusGuard) - corre despues de TenantContextGuard, que ya
// poblo RequestContext desde el JWT, asi que ReadTransaction ambiente alcanza.
@Injectable()
export class PrismaCompanyLookupAdapter implements CompanyLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getStatus(companyId: string): Promise<'Active' | 'Suspended' | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.company.findFirst({ where: { id: companyId }, select: { status: true } }),
    );
    return record?.status ?? null;
  }
}
