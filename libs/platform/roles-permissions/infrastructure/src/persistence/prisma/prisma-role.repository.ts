import { Inject, Injectable } from '@nestjs/common';
import type { Role as PrismaRole } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  asPrismaTransaction,
  PrismaService,
  TENANT_SCOPED_PRISMA,
} from '@platform/persistence-kernel';
import { Permission, Role, type RoleId, RoleName } from '@platform/roles-permissions/domain';
import type { RoleRepository } from '@platform/roles-permissions/application';

// El unico lugar que traduce entre el modelo de Prisma y el agregado de dominio - ningun
// otro archivo de infrastructure/, y ningun archivo de application/, conoce la forma de la
// fila de Postgres (docs/technical/04-PERSISTENCE.md SS2).
@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_SCOPED_PRISMA) private readonly scopedPrisma: PrismaService,
  ) {}

  async findById(id: RoleId): Promise<Role | null> {
    // findFirst (no findUnique) - el Prisma Client Extension de tenant-scope solo cubre
    // findMany/findFirst/count/aggregate (tenant-scope.extension.ts), findUnique no admite
    // where adicional en todas las versiones. companyId=null (System) sigue visible - la
    // extension solo agrega el filtro cuando hay contexto, y RLS ya permite verlo.
    const record = await this.scopedPrisma.role.findFirst({ where: { id: id.toString() } });
    return record ? this.toDomain(record) : null;
  }

  async findByCompanyAndName(companyId: string | null, roleName: string): Promise<Role | null> {
    const record = await this.prisma.role.findFirst({ where: { companyId, roleName } });
    return record ? this.toDomain(record) : null;
  }

  async findAllForCompany(companyId: string): Promise<Role[]> {
    const records = await this.scopedPrisma.role.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(role: Role, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      companyId: role.companyId,
      roleName: role.roleName.toString(),
      scope: role.scope,
      status: role.status,
      permissions: role.permissions.map((p) => p.toString()),
    };

    if (role.isNew) {
      await prisma.role.create({
        data: { id: role.id.toString(), ...data, version: role.version },
      });
      role.markPersisted();
      return;
    }

    const result = await prisma.role.updateMany({
      where: { id: role.id.toString(), version: role.version - 1 },
      data: { ...data, version: role.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('Role', role.id.toString());
    }
  }

  private toDomain(record: PrismaRole): Role {
    return Role.reconstitute({
      id: EntityId.from<'Role'>(record.id),
      companyId: record.companyId,
      roleName: RoleName.from(record.roleName),
      scope: record.scope,
      status: record.status,
      permissions: record.permissions.map((p) => Permission.from(p)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
