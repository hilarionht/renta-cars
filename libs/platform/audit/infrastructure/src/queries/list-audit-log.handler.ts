import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { AuditLogSummary, ListAuditLogQuery } from '@platform/audit/application';

// docs de esta tanda (ver plan de implementacion): lista plana con limite fijo, sin cursor -
// docs/08-API-CONTRACTS.md SS5 exige cursor para listados de alto volumen y nombra Audit
// explicitamente, pero ningun endpoint del codebase lo implemento todavia y el volumen real
// en esta fase es minimo. Gap documentado, no una version a medias del estandar.
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
