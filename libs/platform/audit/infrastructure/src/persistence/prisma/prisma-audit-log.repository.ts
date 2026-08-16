import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '@platform/persistence-kernel';
import type { AuditLogEntry } from '@platform/audit/domain';
import type { AuditLogRepository } from '@platform/audit/application';

// Sin UnitOfWork.run()/ReadTransaction: el INSERT de AuditLogEntry corre FUERA de la
// transaccion de negocio original (DomainEventAuditListener reacciona al evento ya emitido,
// no participa del commit que lo origino) - este repositorio administra su propia
// transaccion minima, solo para el SET LOCAL que RLS necesita.
//
// SET LOCAL condicional: si el evento trae companyId, se fija a ese valor exacto (nunca
// RequestContext ambiente - el listener puede correr fuera de cualquier ciclo de request
// HTTP en el futuro). Si companyId es null (evento verdaderamente global), no hace falta
// fijar nada - la politica RLS de audit_log (company_id = current OR company_id IS NULL)
// pasa por el segundo termino sin importar el valor de current_setting.
@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(entry: AuditLogEntry): Promise<void> {
    const data = {
      id: entry.id.toString(),
      companyId: entry.companyId,
      actorRef: entry.actorRef.toString(),
      action: entry.action.toString(),
      subjectType: entry.subject.toSubjectType(),
      subjectId: entry.subject.toSubjectId(),
      payload: entry.payload as Prisma.InputJsonValue,
      occurredAt: entry.occurredAt,
    };

    if (entry.companyId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${entry.companyId}, true)`;
        await tx.auditLogEntry.create({ data });
      });
      return;
    }

    await this.prisma.auditLogEntry.create({ data });
  }
}
