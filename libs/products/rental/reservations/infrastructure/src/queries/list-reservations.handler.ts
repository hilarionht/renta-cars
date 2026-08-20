import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  ListReservationsQuery,
  ListReservationsResult,
} from '@rental/reservations/application';

@Injectable()
export class ListReservationsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListReservationsQuery): Promise<ListReservationsResult> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.reservation.findMany({
          where: {
            customerId: query.customerId,
            vehicleId: query.vehicleId,
            status: query.status as never,
          },
          include: { authorizedDrivers: { select: { additionalDriverId: true } } },
          orderBy: { createdAt: 'desc' },
        }),
      query.companyId,
    );

    return {
      items: records.map((record) => ({
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
    };
  }
}
