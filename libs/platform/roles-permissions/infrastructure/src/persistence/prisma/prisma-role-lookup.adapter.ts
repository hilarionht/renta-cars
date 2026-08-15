import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { RoleLookupPort } from '@platform/roles-permissions/application';

// Puerto publico consumido por platform-users (AssignRole valida el roleId antes de
// asignarlo). Un role es valido para una company si le pertenece (Custom) o es global
// (System, companyId null). RLS de roles ya contempla ambos casos (company_id IS NULL OR
// company_id = tenant actual) - el SET LOCAL sigue siendo obligatorio para que ese OR
// evalue algo distinto de "todo denegado" (fail-closed).
@Injectable()
export class PrismaRoleLookupAdapter implements RoleLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean> {
    const role = await this.readTransaction.run(
      (tx) =>
        tx.role.findFirst({ where: { id: roleId, OR: [{ companyId }, { companyId: null }] } }),
      companyId,
    );
    return role !== null;
  }
}
