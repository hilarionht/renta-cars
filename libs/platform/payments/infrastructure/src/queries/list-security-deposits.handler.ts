import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  ListSecurityDepositsQuery,
  ListSecurityDepositsResult,
} from '@platform/payments/application';

@Injectable()
export class ListSecurityDepositsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListSecurityDepositsQuery): Promise<ListSecurityDepositsResult> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.securityDeposit.findMany({
          where: { reservationId: query.reservationId },
          orderBy: { createdAt: 'desc' },
        }),
      query.companyId,
    );

    return {
      items: records.map((record) => ({
        id: record.id,
        reservationId: record.reservationId,
        amountMinorUnits: record.amountMinorUnits,
        currency: record.amountCurrency,
        status: record.status,
        gatewayHoldReference: record.gatewayHoldReference ?? undefined,
        retainedAmountMinorUnits: record.retainedAmountMinorUnits ?? undefined,
        retentionReason: record.retentionReason ?? undefined,
      })),
    };
  }
}
