import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { UnitOfWork, UnitOfWorkTransaction } from '@platform/shared-kernel';

import { discardAfterCommit, flushAfterCommit, openAfterCommitBuffer } from './after-commit';
import { PrismaService } from './prisma.service';
import { RequestContext } from './request-context';

// Adapter del puerto UnitOfWork (docs/technical/04-PERSISTENCE.md SS3). Dentro de una
// misma transaccion: (1) SET LOCAL fija app.current_company_id para que las politicas RLS
// apliquen (docs/persistence/06-RLS.md SS1), (2) el trabajo del Command Handler corre sobre
// el mismo `tx`, (3) el repositorio de infraestructura escribe el evento en outbox_event
// (outbox-writer.ts) - las tres cosas atomicas o ninguna.
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async run<T>(work: (tx: UnitOfWorkTransaction) => Promise<T>, companyId?: string): Promise<T> {
    const scopedCompanyId = companyId ?? this.requestContext.get().companyId;

    // #141: los eventos se emiten in-process solo si la transaccion confirma (after-commit.ts).
    let transaction: object | undefined;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        transaction = tx;
        openAfterCommitBuffer(tx);
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${scopedCompanyId}, true)`;
        return work(tx as unknown as UnitOfWorkTransaction);
      });
      if (transaction) {
        flushAfterCommit(transaction);
      }
      return result;
    } catch (error) {
      if (transaction) {
        discardAfterCommit(transaction);
      }
      throw error;
    }
  }
}

// Cast puntual de vuelta a Prisma.TransactionClient - el unico lugar donde infrastructure/
// "abre" el tipo opaco que application/ recibe. Los repositorios Prisma llaman esto, nunca
// application/.
export function asPrismaTransaction(tx: UnitOfWorkTransaction): Prisma.TransactionClient {
  return tx as unknown as Prisma.TransactionClient;
}
