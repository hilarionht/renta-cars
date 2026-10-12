import { Injectable } from '@nestjs/common';

import { decodeCursor, encodeCursor, ReadTransaction } from '@platform/persistence-kernel';
import type { ListUsersQuery, ListUsersResult } from '@platform/users/application';

const DEFAULT_LIMIT = 25;

// docs/persistence/10-DECISIONES.md #134: GET /users, paginado por cursor - mismo patron que
// ListReservationsHandler (#112): take limit+1 para saber si hay pagina siguiente, orden por id
// desc (UUID v7, ordenable por creacion).
@Injectable()
export class ListUsersHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListUsersQuery): Promise<ListUsersResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const records = await this.readTransaction.run(
      (tx) =>
        tx.user.findMany({
          where: {
            companyId: query.companyId,
            ...(query.cursor ? { id: { lt: decodeCursor(query.cursor) } } : {}),
          },
          include: { roles: true },
          orderBy: { id: 'desc' },
          take: limit + 1,
        }),
      query.companyId,
    );

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;

    return {
      items: pageRecords.map((record) => ({
        id: record.id,
        email: record.email,
        name: record.name,
        status: record.status,
        roles: record.roles.map((r) => r.roleId),
        branchId: record.branchId ?? undefined,
      })),
      nextCursor: hasMore ? encodeCursor(pageRecords[pageRecords.length - 1].id) : null,
      limit,
    };
  }
}
