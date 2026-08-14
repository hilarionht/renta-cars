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

    if (!record) {
      return null;
    }

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
