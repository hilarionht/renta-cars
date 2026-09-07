import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { ListRolesQuery, RoleSummary } from '@platform/roles-permissions/application';

// Query Handler en infrastructure/ (no application/) - lee directo via Prisma con
// proyeccion optimizada, sin pasar por el modelo de dominio rico (ADR-0007, CQRS
// selectivo). application/ nunca puede importar Prisma, por eso el handler vive aca aunque
// se llame igual que los de application/.
@Injectable()
export class ListRolesHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListRolesQuery): Promise<RoleSummary[]> {
    return this.readTransaction.run(async (tx) => {
      const records = await tx.role.findMany({
        where: { OR: [{ companyId: query.companyId }, { companyId: null }] },
        orderBy: { roleName: 'asc' },
      });

      return records.map((r) => ({
        id: r.id,
        roleName: r.roleName,
        scope: r.scope,
        status: r.status,
        permissions: r.permissions,
      }));
    });
  }
}
