import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { ListPaymentsQuery, ListPaymentsResult } from '@platform/payments/application';

@Injectable()
export class ListPaymentsHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListPaymentsQuery): Promise<ListPaymentsResult> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.payment.findMany({
          where: { targetType: query.targetType as never, targetId: query.targetId },
          orderBy: { createdAt: 'desc' },
        }),
      query.companyId,
    );

    return {
      items: records.map((record) => ({
        id: record.id,
        targetType: record.targetType,
        targetId: record.targetId,
        amountMinorUnits: record.amountMinorUnits,
        currency: record.amountCurrency,
        method: record.method,
        status: record.status,
        gatewayReference: record.gatewayReference ?? undefined,
        idempotencyKey: record.idempotencyKey,
        failureReason: record.failureReason ?? undefined,
      })),
    };
  }
}
