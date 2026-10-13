import { Injectable } from '@nestjs/common';

import { decodeCursor, encodeCursor, ReadTransaction } from '@platform/persistence-kernel';
import type { ListCustomersQuery, ListCustomersResult } from '@rental/customers/application';

const DEFAULT_LIMIT = 25;

// docs/persistence/10-DECISIONES.md #135: busqueda en el servidor + cursor, mismo patron que
// ListReservationsHandler (#112): take limit+1, orden por id desc (UUID v7). `q` busca sin
// distinguir mayusculas en nombre, documento, email y telefono. Gap aceptado: ILIKE con
// comodin inicial no usa indice (sin pg_trgm); el volumen de clientes por company lo tolera.
@Injectable()
export class ListCustomersHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListCustomersQuery): Promise<ListCustomersResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const q = query.q?.trim();

    const records = await this.readTransaction.run(
      (tx) =>
        tx.customer.findMany({
          where: {
            companyId: query.companyId,
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { taxIdOrDocumentId: { contains: q, mode: 'insensitive' as const } },
                    { contactEmail: { contains: q, mode: 'insensitive' as const } },
                    { contactPhone: { contains: q } },
                  ],
                }
              : {}),
            ...(query.cursor ? { id: { lt: decodeCursor(query.cursor) } } : {}),
          },
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
        name: record.name,
        taxIdOrDocumentId: record.taxIdOrDocumentId,
        customerType: record.customerType,
        status: record.status,
        blockStatus: record.blockStatus,
      })),
      nextCursor: hasMore ? encodeCursor(pageRecords[pageRecords.length - 1].id) : null,
      limit,
    };
  }
}
