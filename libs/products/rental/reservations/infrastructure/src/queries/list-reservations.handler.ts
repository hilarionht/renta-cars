import { Injectable } from '@nestjs/common';

import { decodeCursor, encodeCursor, ReadTransaction } from '@platform/persistence-kernel';
import type {
  ListReservationsQuery,
  ListReservationsResult,
} from '@rental/reservations/application';

const DEFAULT_LIMIT = 25;

@Injectable()
export class ListReservationsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListReservationsQuery): Promise<ListReservationsResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const records = await this.readTransaction.run(
      (tx) =>
        tx.reservation.findMany({
          where: {
            customerId: query.customerId,
            vehicleId: query.vehicleId,
            status: query.status as never,
            ...(query.cursor ? { id: { lt: decodeCursor(query.cursor) } } : {}),
          },
          include: { authorizedDrivers: { select: { additionalDriverId: true } } },
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
        customerId: record.customerId,
        vehicleId: record.vehicleId,
        status: record.status,
        startDate: record.startDate.toISOString(),
        endDate: record.endDate.toISOString(),
        baseAmountMinorUnits: record.baseAmountMinorUnits,
        currency: record.baseAmountCurrency,
        authorizedDriverIds: record.authorizedDrivers.map((driver) => driver.additionalDriverId),
      })),
      nextCursor: hasMore ? encodeCursor(pageRecords[pageRecords.length - 1].id) : null,
      limit,
    };
  }
}
