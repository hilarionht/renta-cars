import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  GetSecurityDepositQuery,
  SecurityDepositSummary,
} from '@platform/payments/application';
import { SecurityDepositNotFoundError } from '@platform/payments/domain';

@Injectable()
export class GetSecurityDepositHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetSecurityDepositQuery): Promise<SecurityDepositSummary> {
    const record = await this.readTransaction.run(
      (tx) => tx.securityDeposit.findFirst({ where: { id: query.securityDepositId } }),
      query.companyId,
    );

    if (!record) {
      throw new SecurityDepositNotFoundError(query.securityDepositId);
    }

    return {
      id: record.id,
      reservationId: record.reservationId,
      amountMinorUnits: record.amountMinorUnits,
      currency: record.amountCurrency,
      status: record.status,
      gatewayHoldReference: record.gatewayHoldReference ?? undefined,
      retainedAmountMinorUnits: record.retainedAmountMinorUnits ?? undefined,
      retentionReason: record.retentionReason ?? undefined,
    };
  }
}
