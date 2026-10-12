import { Injectable } from '@nestjs/common';
import type { CustomerOtpChallenge as PrismaCustomerOtpChallenge } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import { CustomerOtpChallenge, CustomerOtpCodeHash } from '@rental/customers/domain';
import type { CustomerOtpChallengeRepository } from '@rental/customers/application';

@Injectable()
export class PrismaCustomerOtpChallengeRepository implements CustomerOtpChallengeRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findLatestForCustomer(
    customerId: string,
    companyId: string,
  ): Promise<CustomerOtpChallenge | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.customerOtpChallenge.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(challenge: CustomerOtpChallenge, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);

    if (challenge.isNew) {
      await prisma.customerOtpChallenge.create({
        data: {
          id: challenge.id.toString(),
          companyId: challenge.companyId,
          customerId: challenge.customerId,
          phone: challenge.phone,
          codeHash: challenge.codeHash.toString(),
          status: challenge.status,
          attempts: challenge.attempts,
          maxAttempts: challenge.maxAttempts,
          expiresAt: challenge.expiresAt,
          version: challenge.version,
        },
      });
      challenge.markPersisted();
      return;
    }

    const result = await prisma.customerOtpChallenge.updateMany({
      where: { id: challenge.id.toString(), version: challenge.version - 1 },
      data: { status: challenge.status, attempts: challenge.attempts, version: challenge.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('CustomerOtpChallenge', challenge.id.toString());
    }
  }

  private toDomain(record: PrismaCustomerOtpChallenge): CustomerOtpChallenge {
    return CustomerOtpChallenge.reconstitute({
      id: EntityId.from<'CustomerOtpChallenge'>(record.id),
      companyId: record.companyId,
      customerId: record.customerId,
      phone: record.phone,
      codeHash: CustomerOtpCodeHash.fromHash(record.codeHash),
      status: record.status,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      version: record.version,
    });
  }
}
