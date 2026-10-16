import { Injectable } from '@nestjs/common';

import { decodeCursor, encodeCursor, ReadTransaction } from '@platform/persistence-kernel';
import type { ListAuditLogQuery, ListAuditLogResult } from '@platform/audit/application';

// docs/persistence/10-DECISIONES.md #140: cursor (docs/08-API-CONTRACTS.md SS5 lo exige para
// Audit; mismo mecanismo que #112) y filtro from/to sobre occurredAt. El orden es el de registro
// (id v7 generado al transcribir el evento), no occurredAt: estable para paginar.
const DEFAULT_LIMIT = 50;

@Injectable()
export class ListAuditLogHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListAuditLogQuery): Promise<ListAuditLogResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const occurredAt =
      query.from || query.to
        ? { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) }
        : undefined;

    const records = await this.readTransaction.run(
      (tx) =>
        tx.auditLogEntry.findMany({
          where: {
            companyId: query.companyId,
            subjectType: query.subjectType,
            subjectId: query.subjectId,
            occurredAt,
            ...(query.cursor ? { id: { lt: decodeCursor(query.cursor) } } : {}),
          },
          orderBy: { id: 'desc' },
          take: limit + 1,
        }),
      query.companyId,
    );

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    return {
      items: page.map((record) => ({
        id: record.id,
        actorRef: record.actorRef,
        action: record.action,
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        payload: record.payload as Record<string, unknown>,
        occurredAt: record.occurredAt,
      })),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1].id) : null,
      limit,
    };
  }
}
