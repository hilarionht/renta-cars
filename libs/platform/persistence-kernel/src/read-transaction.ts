import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';
import { RequestContext } from './request-context';

// Los Query Handlers (lectura) tambien necesitan SET LOCAL - sin una transaccion que lo
// fije, RLS deniega todo por fail-closed (docs/persistence/06-RLS.md SS6, decision #11).
// Distinto de PrismaUnitOfWork: esto no es "trabajo transaccional" en el sentido de negocio
// (no hay Outbox, no hay invariantes que proteger), es puramente el vehiculo minimo para
// que `current_setting('app.current_company_id')` exista durante la lectura.
//
// PrismaService crudo, NO TENANT_SCOPED_PRISMA - se probo usar el cliente extendido (para
// heredar tambien el auto-filtro de companyId, segunda capa, ADR-0004) pero el extension
// agrega un `companyId` a nivel raiz del `where` sin importar la forma de la query. Eso
// rompe cualquier lectura que ya use OR para "global O mio" (roles System: companyId IS
// NULL) - el AND implicito entre ese companyId forzado y el OR original vuelve la fila
// System irrepresentable. RLS (fijado abajo via SET LOCAL) ya es la capa autoritativa; el
// Client Extension queda reservado a queries que de verdad son "solo mio", nunca inyectado
// aca donde el shape del `where` es responsabilidad exclusiva del caller.
@Injectable()
export class ReadTransaction {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  // companyId opcional: los comandos de platform-identity (Login/RefreshSession) corren en
  // rutas @Public() sin RequestContext poblado, pero ya conocen el companyId por otra via
  // (body de login, o la Session/User ya encontrada) - mismo mecanismo que UnitOfWork.run().
  async run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, companyId?: string): Promise<T> {
    const scopedCompanyId = companyId ?? this.requestContext.get().companyId;

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${scopedCompanyId}, true)`;
        return work(tx);
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
