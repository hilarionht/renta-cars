import { Injectable } from '@nestjs/common';

import { PrismaService } from '@platform/persistence-kernel';
import type { UserLookupPort, UserLookupResult } from '@platform/users/application';

// Puerto publico consumido por platform-identity (Login) - superficie minima de solo
// lectura, nunca expone UserRepository completo cross-modulo.
@Injectable()
export class PrismaUserLookupAdapter implements UserLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompanyAndEmail(companyId: string, email: string): Promise<UserLookupResult | null> {
    const record = await this.prisma.user.findFirst({
      where: { companyId, email },
      include: { roles: true },
    });
    return record ? this.toResult(record) : null;
  }

  async findById(userId: string): Promise<UserLookupResult | null> {
    const record = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { roles: true },
    });
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
