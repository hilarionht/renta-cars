import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetPaymentQuery, PaymentSummary } from '@platform/payments/application';
import { PaymentNotFoundError } from '@platform/payments/domain';

@Injectable()
export class GetPaymentHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetPaymentQuery): Promise<PaymentSummary> {
    const record = await this.readTransaction.run(
      (tx) => tx.payment.findFirst({ where: { id: query.paymentId } }),
      query.companyId,
    );

    if (!record) {
      throw new PaymentNotFoundError(query.paymentId);
    }

    return {
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
    };
  }
}
