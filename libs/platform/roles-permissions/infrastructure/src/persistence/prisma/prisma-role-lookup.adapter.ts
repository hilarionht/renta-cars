import { Injectable } from '@nestjs/common';

import { PrismaService } from '@platform/persistence-kernel';
import type { RoleLookupPort } from '@platform/roles-permissions/application';

// Puerto publico consumido por platform-users (AssignRole valida el roleId antes de
// asignarlo). Un role es valido para una company si le pertenece (Custom) o es global
// (System, companyId null).
@Injectable()
export class PrismaRoleLookupAdapter implements RoleLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, OR: [{ companyId }, { companyId: null }] },
    });
    return role !== null;
  }
}
