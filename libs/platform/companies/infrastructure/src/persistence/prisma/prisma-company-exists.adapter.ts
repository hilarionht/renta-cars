import { Injectable } from '@nestjs/common';

import type { CompanyExistsPort } from '@platform/shared-kernel';
import { ReadTransaction } from '@platform/persistence-kernel';

// Reemplaza a NoopCompanyExistsAdapter (apps/api) ahora que Companies existe de verdad -
// consumido hoy por CreateUserHandler (platform-users). Corre siempre en rutas autenticadas
// (companyId viene del propio JWT del caller), asi que ReadTransaction ambiente alcanza -
// nunca se llama con el companyId de OTRA company.
@Injectable()
export class PrismaCompanyExistsAdapter implements CompanyExistsPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async exists(companyId: string): Promise<boolean> {
    const record = await this.readTransaction.run((tx) =>
      tx.company.findFirst({ where: { id: companyId }, select: { id: true } }),
    );
    return record !== null;
  }
}
