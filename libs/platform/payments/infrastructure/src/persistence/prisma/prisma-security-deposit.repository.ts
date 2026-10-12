import { Injectable } from '@nestjs/common';
import type { SecurityDeposit as PrismaSecurityDeposit } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  Money,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { SecurityDeposit, type SecurityDepositId } from '@platform/payments/domain';
import type { SecurityDepositRepository } from '@platform/payments/application';

@Injectable()
export class PrismaSecurityDepositRepository implements SecurityDepositRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: SecurityDepositId, companyId?: string): Promise<SecurityDeposit | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.securityDeposit.findFirst({ where: { id: id.toString() } }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async findByReservationId(
    reservationId: string,
    companyId?: string,
  ): Promise<SecurityDeposit | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.securityDeposit.findFirst({ where: { reservationId } }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(deposit: SecurityDeposit, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: deposit.companyId,
      reservationId: deposit.reservationId,
      amountMinorUnits: deposit.amount.minorUnits,
      amountCurrency: deposit.amount.currencyCode,
      status: deposit.status,
      gatewayHoldReference: deposit.gatewayHoldReference ?? null,
      retainedAmountMinorUnits: deposit.retainedAmount?.minorUnits ?? null,
      retentionReason: deposit.retentionReason ?? null,
    };

    if (deposit.isNew) {
      await prisma.securityDeposit.create({
        data: { id: deposit.id.toString(), ...rootData, version: deposit.version },
      });
      deposit.markPersisted();
    } else {
      const result = await prisma.securityDeposit.updateMany({
        where: { id: deposit.id.toString(), version: deposit.version - 1 },
        data: {
          status: rootData.status,
          gatewayHoldReference: rootData.gatewayHoldReference,
          retainedAmountMinorUnits: rootData.retainedAmountMinorUnits,
          retentionReason: rootData.retentionReason,
          version: deposit.version,
        },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('SecurityDeposit', deposit.id.toString());
      }
    }
  }

  private toDomain(record: PrismaSecurityDeposit): SecurityDeposit {
    return SecurityDeposit.reconstitute({
      id: EntityId.from<'SecurityDeposit'>(record.id),
      companyId: record.companyId,
      reservationId: record.reservationId,
      amount: Money.from(record.amountMinorUnits, record.amountCurrency),
      status: record.status,
      gatewayHoldReference: record.gatewayHoldReference ?? undefined,
      retainedAmount:
        record.retainedAmountMinorUnits != null
          ? Money.from(record.retainedAmountMinorUnits, record.amountCurrency)
          : undefined,
      retentionReason: record.retentionReason ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
