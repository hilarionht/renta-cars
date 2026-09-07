import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetReservationQuery, ReservationSummary } from '@rental/reservations/application';
import { ReservationNotFoundError } from '@rental/reservations/domain';

@Injectable()
export class GetReservationHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetReservationQuery): Promise<ReservationSummary> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.reservation.findFirst({
          where: { id: query.reservationId },
          include: { authorizedDrivers: { select: { additionalDriverId: true } } },
        }),
      query.companyId,
    );

    if (!record) {
      throw new ReservationNotFoundError(query.reservationId);
    }

    return {
      id: record.id,
      customerId: record.customerId,
      vehicleId: record.vehicleId,
      status: record.status,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      baseAmountMinorUnits: record.baseAmountMinorUnits,
      currency: record.baseAmountCurrency,
      authorizedDriverIds: record.authorizedDrivers.map((driver) => driver.additionalDriverId),
    };
  }
}
