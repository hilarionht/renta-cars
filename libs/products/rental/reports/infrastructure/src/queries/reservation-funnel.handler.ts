import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { InvalidReportRangeError } from '@rental/reports/application';
import type { ReservationFunnelQuery, ReservationFunnelResult } from '@rental/reports/application';

@Injectable()
export class ReservationFunnelHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ReservationFunnelQuery): Promise<ReservationFunnelResult> {
    if (query.from > query.to) {
      throw new InvalidReportRangeError(query.from, query.to);
    }

    const groups = await this.readTransaction.run(
      (tx) =>
        tx.reservation.groupBy({
          by: ['status'],
          where: { createdAt: { gte: new Date(query.from), lte: new Date(query.to) } },
          _count: true,
        }),
      query.companyId,
    );

    return {
      items: groups.map((group) => ({ status: group.status, count: group._count })),
    };
  }
}
