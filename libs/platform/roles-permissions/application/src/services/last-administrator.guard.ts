import { Inject, Injectable } from '@nestjs/common';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { LastAdministratorError } from '@platform/roles-permissions/domain';

import {
  type ActiveRoleAssignment,
  ROLE_ASSIGNMENTS_PORT,
  type RoleAssignmentsPort,
} from '../ports/role-assignments.port';

// docs/persistence/10-DECISIONES.md #140. Administrador = usuario Active cuyos roles Active,
// sumados, tienen estos dos permisos: con ellos puede crear un role con todo y asignarselo.
export const ADMINISTRATION_PERMISSIONS = ['users:assign-role', 'roles:create'] as const;

export type AdministratorChange =
  | { kind: 'disable-user'; userId: string }
  | { kind: 'revoke-role'; userId: string; roleId: string }
  | { kind: 'edit-role-permissions'; roleId: string; permissions: string[] };

export function countAdministrators(assignments: readonly ActiveRoleAssignment[]): number {
  const permissionsByUser = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const permissions = permissionsByUser.get(assignment.userId) ?? new Set<string>();
    assignment.permissions.forEach((permission) => permissions.add(permission));
    permissionsByUser.set(assignment.userId, permissions);
  }
  let administrators = 0;
  for (const permissions of permissionsByUser.values()) {
    if (ADMINISTRATION_PERMISSIONS.every((permission) => permissions.has(permission))) {
      administrators += 1;
    }
  }
  return administrators;
}

export function applyChange(
  assignments: readonly ActiveRoleAssignment[],
  change: AdministratorChange,
): ActiveRoleAssignment[] {
  switch (change.kind) {
    case 'disable-user':
      return assignments.filter((assignment) => assignment.userId !== change.userId);
    case 'revoke-role':
      return assignments.filter(
        (assignment) =>
          !(assignment.userId === change.userId && assignment.roleId === change.roleId),
      );
    case 'edit-role-permissions':
      return assignments.map((assignment) =>
        assignment.roleId === change.roleId
          ? { ...assignment, permissions: change.permissions }
          : assignment,
      );
  }
}

@Injectable()
export class LastAdministratorGuard {
  constructor(
    @Inject(ROLE_ASSIGNMENTS_PORT) private readonly roleAssignments: RoleAssignmentsPort,
  ) {}

  // Llamar dentro del UnitOfWork, antes de guardar: el lock serializa dos cambios simultaneos
  // (dos admins revocandose entre si) y el segundo ve el commit del primero (READ COMMITTED).
  // Si la company ya no tenia administradores, no bloquea (no empeora nada).
  async assertAdministratorRemains(
    tx: UnitOfWorkTransaction,
    companyId: string,
    change: AdministratorChange,
  ): Promise<void> {
    const assignments = await this.roleAssignments.lockAndListActiveAssignments(tx, companyId);
    const before = countAdministrators(assignments);
    if (before > 0 && countAdministrators(applyChange(assignments, change)) === 0) {
      throw new LastAdministratorError();
    }
  }
}
