import { Injectable } from '@nestjs/common';
import type { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

import {
  ConcurrentModificationError,
  Email,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  EncryptedMfaSecret,
  PasswordHash,
  PersonName,
  User,
  type UserId,
} from '@platform/users/domain';
import type { UserRepository } from '@platform/users/application';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  // Sin companyId explicito - estos dos metodos siempre corren en rutas autenticadas
  // (TenantContextGuard ya poblo RequestContext), a diferencia de PrismaUserLookupAdapter
  // (consumido por Login/RefreshSession, sin JWT todavia).
  async findById(id: UserId): Promise<User | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.user.findFirst({ where: { id: id.toString() }, include: { roles: true } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async findByCompanyAndEmail(companyId: string, email: string): Promise<User | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.user.findFirst({ where: { companyId, email }, include: { roles: true } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(user: User, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      companyId: user.companyId,
      branchId: user.branchId,
      email: user.email.toString(),
      passwordHash: user.passwordHash.toString(),
      name: user.name.toString(),
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mfaSecretEncrypted: user.mfaSecret?.toString() ?? null,
    };

    if (user.isNew) {
      await prisma.user.create({
        data: { id: user.id.toString(), ...data, version: user.version },
      });
      await this.syncRoles(prisma, user);
      user.markPersisted();
      return;
    }

    const result = await prisma.user.updateMany({
      where: { id: user.id.toString(), version: user.version - 1 },
      data: { ...data, version: user.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('User', user.id.toString());
    }

    await this.syncRoles(prisma, user);
  }

  // user_roles no tiene su propia version - se sincroniza reemplazando el set completo
  // dentro de la misma transaccion que el UPDATE/INSERT de users (docs/persistence/
  // 03-RELACIONES.md SS2.1: user_roles es parte del agregado User).
  private async syncRoles(
    prisma: ReturnType<typeof asPrismaTransaction>,
    user: User,
  ): Promise<void> {
    await prisma.userRole.deleteMany({ where: { userId: user.id.toString() } });
    if (user.roles.length > 0) {
      await prisma.userRole.createMany({
        data: user.roles.map((roleId) => ({
          userId: user.id.toString(),
          roleId,
          companyId: user.companyId,
        })),
      });
    }
  }

  private toDomain(record: PrismaUser & { roles?: PrismaUserRole[] }): User {
    return User.reconstitute({
      id: EntityId.from<'User'>(record.id),
      companyId: record.companyId,
      branchId: record.branchId ?? undefined,
      email: Email.from(record.email),
      passwordHash: PasswordHash.fromHash(record.passwordHash),
      name: PersonName.from(record.name),
      status: record.status,
      roles: (record.roles ?? []).map((r) => r.roleId),
      mfaEnabled: record.mfaEnabled,
      mfaSecret: record.mfaSecretEncrypted
        ? EncryptedMfaSecret.fromEncrypted(record.mfaSecretEncrypted)
        : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
