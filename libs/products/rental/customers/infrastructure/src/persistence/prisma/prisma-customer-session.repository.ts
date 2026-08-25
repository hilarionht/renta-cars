import { Injectable } from '@nestjs/common';
import type { CustomerSession as PrismaCustomerSession } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, PrismaService, ReadTransaction } from '@platform/persistence-kernel';
import {
  CustomerDeviceContext,
  CustomerRefreshTokenHash,
  CustomerSession,
  type CustomerSessionId,
} from '@rental/customers/domain';
import type { CustomerSessionRepository } from '@rental/customers/application';

// Espejo deliberado de platform/identity/infrastructure/src/persistence/prisma/
// prisma-session.repository.ts - ver customer-session.ts para la razon de la duplicacion.
@Injectable()
export class PrismaCustomerSessionRepository implements CustomerSessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readTransaction: ReadTransaction,
  ) {}

  async findById(id: CustomerSessionId): Promise<CustomerSession | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.customerSession.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  // No pasa por ReadTransaction (no hay companyId conocido todavia) - fija un GUC propio,
  // distinto del de identity.sessions (app.customer_session_lookup_by_hash, nunca
  // app.session_lookup_by_hash - 2 fronteras de seguridad aisladas), en su propia
  // transaccion minima, nunca junto con una escritura. Ver migration
  // 20260825223600_rental_customer_sessions_rls.
  async findByRefreshTokenHash(hash: string): Promise<CustomerSession | null> {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.customer_session_lookup_by_hash', 'true', true)`;
      return tx.customerSession.findFirst({ where: { refreshTokenHash: hash } });
    });
    return record ? this.toDomain(record) : null;
  }

  async findActiveForCustomer(customerId: string, companyId: string): Promise<CustomerSession[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.customerSession.findMany({ where: { customerId, status: 'Active' } }),
      companyId,
    );
    return records.map((r) => this.toDomain(r));
  }

  async save(session: CustomerSession, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      customerId: session.customerId,
      companyId: session.companyId,
      refreshTokenHash: session.refreshTokenHash.toString(),
      status: session.status,
    };

    if (session.isNew) {
      await prisma.customerSession.create({
        data: { id: session.id.toString(), ...data, version: session.version },
      });
      session.markPersisted();
      return;
    }

    const result = await prisma.customerSession.updateMany({
      where: { id: session.id.toString(), version: session.version - 1 },
      data: {
        ...data,
        rotatedAt: session.status === 'Rotated' ? new Date() : undefined,
        version: session.version,
      },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('CustomerSession', session.id.toString());
    }
  }

  private toDomain(record: PrismaCustomerSession): CustomerSession {
    return CustomerSession.reconstitute({
      id: EntityId.from<'CustomerSession'>(record.id),
      customerId: record.customerId,
      companyId: record.companyId,
      refreshTokenHash: CustomerRefreshTokenHash.fromHash(record.refreshTokenHash),
      deviceContext: CustomerDeviceContext.from({
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
