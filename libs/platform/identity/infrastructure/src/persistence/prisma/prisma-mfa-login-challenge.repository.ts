import { Injectable } from '@nestjs/common';
import type { MfaLoginChallenge as PrismaMfaLoginChallenge } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import { MfaLoginChallenge, type MfaLoginChallengeId } from '@platform/identity/domain';
import type { MfaLoginChallengeRepository } from '@platform/identity/application';

@Injectable()
export class PrismaMfaLoginChallengeRepository implements MfaLoginChallengeRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: MfaLoginChallengeId, companyId: string): Promise<MfaLoginChallenge | null> {
    const record = await this.readTransaction.run(
      (tx) => tx.mfaLoginChallenge.findFirst({ where: { id: id.toString() } }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(challenge: MfaLoginChallenge, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);

    if (challenge.isNew) {
      await prisma.mfaLoginChallenge.create({
        data: {
          id: challenge.id.toString(),
          companyId: challenge.companyId,
          userId: challenge.userId,
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

    const result = await prisma.mfaLoginChallenge.updateMany({
      where: { id: challenge.id.toString(), version: challenge.version - 1 },
      data: { status: challenge.status, attempts: challenge.attempts, version: challenge.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('MfaLoginChallenge', challenge.id.toString());
    }
  }

  private toDomain(record: PrismaMfaLoginChallenge): MfaLoginChallenge {
    return MfaLoginChallenge.reconstitute({
      id: EntityId.from<'MfaLoginChallenge'>(record.id),
      companyId: record.companyId,
      userId: record.userId,
      status: record.status,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      version: record.version,
    });
  }
}
