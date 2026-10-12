import { Injectable } from '@nestjs/common';
import type { Session as PrismaSession } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, PrismaService, ReadTransaction } from '@platform/persistence-kernel';
import {
  DeviceContext,
  RefreshTokenHash,
  Session,
  type SessionId,
} from '@platform/identity/domain';
import type { SessionRepository } from '@platform/identity/application';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readTransaction: ReadTransaction,
  ) {}

  async findById(id: SessionId): Promise<Session | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.session.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  // No pasa por ReadTransaction (no hay companyId conocido todavia) - fija un GUC nombrado y
  // acotado (app.session_lookup_by_hash) en su propia transaccion minima, nunca junto con una
  // escritura. refresh_token_hash es @unique globalmente (secreto de 256 bits) - conocer el
  // valor en texto plano es la autorizacion real, no el tenant (ver migration
  // 20260815050000_sessions_lookup_by_hash_rls y docs/persistence/10-DECISIONES.md).
  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.session_lookup_by_hash', 'true', true)`;
      return tx.session.findFirst({ where: { refreshTokenHash: hash } });
    });
    return record ? this.toDomain(record) : null;
  }

  async findActiveForUser(userId: string, companyId: string): Promise<Session[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.session.findMany({ where: { userId, status: 'Active' } }),
      companyId,
    );
    return records.map((r) => this.toDomain(r));
  }

  async save(session: Session, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      userId: session.userId,
      companyId: session.companyId,
      refreshTokenHash: session.refreshTokenHash.toString(),
      status: session.status,
    };

    if (session.isNew) {
      await prisma.session.create({
        data: { id: session.id.toString(), ...data, version: session.version },
      });
      session.markPersisted();
      return;
    }

    const result = await prisma.session.updateMany({
      where: { id: session.id.toString(), version: session.version - 1 },
      data: {
        ...data,
        rotatedAt: session.status === 'Rotated' ? new Date() : undefined,
        version: session.version,
      },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('Session', session.id.toString());
    }
  }

  private toDomain(record: PrismaSession): Session {
    return Session.reconstitute({
      id: EntityId.from<'Session'>(record.id),
      userId: record.userId,
      companyId: record.companyId,
      refreshTokenHash: RefreshTokenHash.fromHash(record.refreshTokenHash),
      deviceContext: DeviceContext.from({
        userAgent: record.deviceUserAgent ?? undefined,
        ipAddress: record.deviceIpAddress ?? undefined,
      }),
      status: record.status,
      issuedAt: record.issuedAt,
      rotatedAt: record.rotatedAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
