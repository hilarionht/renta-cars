import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { UserLookupPort, UserLookupResult } from '@platform/users/application';

// Puerto publico consumido por platform-identity (Login) - superficie minima de solo
// lectura, nunca expone UserRepository completo cross-modulo. Login/RefreshSession corren
// sin RequestContext poblado (@Public()) - companyId siempre explicito, nunca ambiente.
@Injectable()
export class PrismaUserLookupAdapter implements UserLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findByCompanyAndEmail(companyId: string, email: string): Promise<UserLookupResult | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.user.findFirst({ where: { companyId, email }, include: { roles: true } }),
      companyId,
    );
    return record ? this.toResult(record) : null;
  }

  async findById(userId: string, companyId: string): Promise<UserLookupResult | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.user.findFirst({ where: { id: userId, companyId }, include: { roles: true } }),
      companyId,
    );
    return record ? this.toResult(record) : null;
  }

  private toResult(record: {
    id: string;
    companyId: string;
    branchId: string | null;
    passwordHash: string;
    status: string;
    roles: { roleId: string }[];
  }): UserLookupResult {
    return {
      userId: record.id,
      companyId: record.companyId,
      branchId: record.branchId ?? undefined,
      passwordHash: record.passwordHash,
      status: record.status,
      roles: record.roles.map((r) => r.roleId),
    };
  }
}
