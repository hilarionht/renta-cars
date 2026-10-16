import { Injectable } from '@nestjs/common';

import { type UnitOfWorkTransaction } from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import type {
  ActiveRoleAssignment,
  RoleAssignmentsPort,
} from '@platform/roles-permissions/application';

// docs/persistence/10-DECISIONES.md #140. users, user_roles y roles viven en el mismo schema
// (identity) y Prisma ya modela UserRole.role/.user: lectura directa, con companyId explicito.
@Injectable()
export class PrismaRoleAssignmentsAdapter implements RoleAssignmentsPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async lockAndListActiveAssignments(
    tx: UnitOfWorkTransaction,
    companyId: string,
  ): Promise<ActiveRoleAssignment[]> {
    const prisma = asPrismaTransaction(tx);
    const lockKey = `${companyId}:administrators`;
    // pg_advisory_xact_lock devuelve void: en el FROM produce una fila sin columnas tipadas.
    await prisma.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const rows = await prisma.userRole.findMany({
      where: { companyId, user: { status: 'Active' }, role: { status: 'Active' } },
      select: { userId: true, roleId: true, role: { select: { permissions: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      roleId: row.roleId,
      permissions: row.role.permissions,
    }));
  }

  async findUserIdsWithRole(roleId: string, companyId: string): Promise<string[]> {
    const rows = await this.readTransaction.run((tx) =>
      tx.userRole.findMany({ where: { roleId, companyId }, select: { userId: true } }),
    );
    return rows.map((row) => row.userId);
  }
}
