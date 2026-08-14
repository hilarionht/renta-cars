import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';
import { RequestContext } from './request-context';

// Los Query Handlers (lectura) tambien necesitan SET LOCAL - sin una transaccion que lo
// fije, RLS deniega todo por fail-closed (docs/persistence/06-RLS.md SS6, decision #11).
// Distinto de PrismaUnitOfWork: esto no es "trabajo transaccional" en el sentido de negocio
// (no hay Outbox, no hay invariantes que proteger), es puramente el vehiculo minimo para
// que `current_setting('app.current_company_id')` exista durante la lectura.
@Injectable()
export class ReadTransaction {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const { companyId } = this.requestContext.get();

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
        return work(tx);
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
