import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { AuditLogSummary, ListAuditLogQuery } from '@platform/audit/application';

// Lista plana con limite fijo, sin cursor - docs/08-API-CONTRACTS.md SS5 exige cursor para
// listados de alto volumen y nombra Audit explicitamente. El mecanismo ya existe de verdad
// (GET /reservations lo implemento primero, docs/persistence/10-DECISIONES.md #112,
// encodeCursor/decodeCursor en @platform/persistence-kernel) - este endpoint no lo adopto
// todavia porque el volumen real en esta fase es minimo, no porque el mecanismo no exista.
// Gap documentado, no una version a medias del estandar.
const LIST_LIMIT = 100;

@Injectable()
export class ListAuditLogHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListAuditLogQuery): Promise<AuditLogSummary[]> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.auditLogEntry.findMany({
          where: {
            companyId: query.companyId,
            subjectType: query.subjectType,
            subjectId: query.subjectId,
          },
          orderBy: { occurredAt: 'desc' },
          take: LIST_LIMIT,
        }),
      query.companyId,
    );

    return records.map((record) => ({
      id: record.id,
      actorRef: record.actorRef,
      action: record.action,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      payload: record.payload as Record<string, unknown>,
      occurredAt: record.occurredAt,
    }));
  }
}
