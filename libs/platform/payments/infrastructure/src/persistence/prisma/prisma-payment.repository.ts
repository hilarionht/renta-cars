import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Payment as PrismaPayment } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  Money,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  Payment,
  type PaymentId,
  PaymentAlreadyProcessedError,
  PaymentMethod,
} from '@platform/payments/domain';
import type { PaymentRepository } from '@platform/payments/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: PaymentId): Promise<Payment | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.payment.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async findByGatewayReference(
    gatewayReference: string,
    companyId: string,
  ): Promise<Payment | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.payment.findFirst({ where: { gatewayReference, companyId } }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(payment: Payment, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: payment.companyId,
      targetType: payment.targetType,
      targetId: payment.targetId,
      amountMinorUnits: payment.amount.minorUnits,
      amountCurrency: payment.amount.currencyCode,
      method: payment.method.toString(),
      status: payment.status,
      gatewayReference: payment.gatewayReference ?? null,
      idempotencyKey: payment.idempotencyKey,
      failureReason: payment.failureReason ?? null,
    };

    if (payment.isNew) {
      try {
        await prisma.payment.create({
          data: {
            id: payment.id.toString(),
            ...rootData,
            method: rootData.method as never,
            version: payment.version,
          },
        });
      } catch (error) {
        throw this.mapUniqueConstraintViolation(error, payment);
      }
      payment.markPersisted();
    } else {
      const result = await prisma.payment.updateMany({
        where: { id: payment.id.toString(), version: payment.version - 1 },
        data: {
          status: rootData.status,
          gatewayReference: rootData.gatewayReference,
          failureReason: rootData.failureReason,
          version: payment.version,
        },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('Payment', payment.id.toString());
      }
    }
  }

  private mapUniqueConstraintViolation(error: unknown, payment: Payment): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      const driverMessage = this.extractDriverErrorMessage(error);
      if (driverMessage.includes('payments_company_id_idempotency_key_key')) {
        return new PaymentAlreadyProcessedError(payment.idempotencyKey);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private extractDriverErrorMessage(error: Prisma.PrismaClientKnownRequestError): string {
    const driverAdapterError = error.meta?.['driverAdapterError'];
    if (driverAdapterError && typeof driverAdapterError === 'object') {
      const cause = (driverAdapterError as { cause?: unknown }).cause;
      if (cause && typeof cause === 'object') {
        const originalMessage = (cause as { originalMessage?: unknown }).originalMessage;
        if (typeof originalMessage === 'string') {
          return originalMessage;
        }
      }
    }
    return error.message;
  }

  private toDomain(record: PrismaPayment): Payment {
    return Payment.reconstitute({
      id: EntityId.from<'Payment'>(record.id),
      companyId: record.companyId,
      targetType: record.targetType,
      targetId: record.targetId,
      amount: Money.from(record.amountMinorUnits, record.amountCurrency),
      method: PaymentMethod.from(record.method),
      status: record.status,
      gatewayReference: record.gatewayReference ?? undefined,
      idempotencyKey: record.idempotencyKey,
      failureReason: record.failureReason ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
