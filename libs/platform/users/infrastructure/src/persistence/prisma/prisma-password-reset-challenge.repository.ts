import { Injectable } from '@nestjs/common';
import type { PasswordResetChallenge as PrismaPasswordResetChallenge } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, PrismaService } from '@platform/persistence-kernel';
import { PasswordResetChallenge, PasswordResetTokenHash } from '@platform/users/domain';
import type { PasswordResetChallengeRepository } from '@platform/users/application';

@Injectable()
export class PrismaPasswordResetChallengeRepository implements PasswordResetChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Bypasea tenant-scoping via un GUC nombrado, fijado en su propia transaccion minima,
  // nunca junto con una escritura - mismo patron exacto que
  // PrismaSessionRepository.findByRefreshTokenHash. companyId es desconocido hasta
  // encontrar la fila (conocer el valor del token en texto plano ES la autorizacion).
  async findByTokenHash(tokenHash: string): Promise<PasswordResetChallenge | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.password_reset_lookup_by_hash', 'true', true)`;
      return tx.passwordResetChallenge.findFirst({ where: { tokenHash } });
    });
    return record ? this.toDomain(record) : null;
  }

  async save(challenge: PasswordResetChallenge, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);

    if (challenge.isNew) {
      await prisma.passwordResetChallenge.create({
        data: {
          id: challenge.id.toString(),
          companyId: challenge.companyId,
          userId: challenge.userId,
          tokenHash: challenge.tokenHash.toString(),
          status: challenge.status,
          expiresAt: challenge.expiresAt,
          version: challenge.version,
        },
      });
      challenge.markPersisted();
      return;
    }

    const result = await prisma.passwordResetChallenge.updateMany({
      where: { id: challenge.id.toString(), version: challenge.version - 1 },
      data: { status: challenge.status, version: challenge.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('PasswordResetChallenge', challenge.id.toString());
    }
  }

  private toDomain(record: PrismaPasswordResetChallenge): PasswordResetChallenge {
    return PasswordResetChallenge.reconstitute({
      id: EntityId.from<'PasswordResetChallenge'>(record.id),
      companyId: record.companyId,
      userId: record.userId,
      tokenHash: PasswordResetTokenHash.fromHash(record.tokenHash),
      status: record.status,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      version: record.version,
    });
  }
}
