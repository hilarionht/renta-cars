import type { UnitOfWorkTransaction } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140: lectura de las asignaciones de roles de una company,
// para el invariante del ultimo administrador y para no desactivar un role con usuarios. Vive en
// roles-permissions (no en users) porque users ya depende de este modulo: al reves seria un ciclo.
export const ROLE_ASSIGNMENTS_PORT = Symbol('RoleAssignmentsPort');

// Solo usuarios Active con roles Active: lo unico que otorga permisos efectivos.
export interface ActiveRoleAssignment {
  userId: string;
  roleId: string;
  permissions: string[];
}

export interface RoleAssignmentsPort {
  // Toma un lock transaccional por company (serializa los cambios que pueden dejarla sin
  // administrador) y despues lee las asignaciones vigentes dentro de la misma transaccion.
  lockAndListActiveAssignments(
    tx: UnitOfWorkTransaction,
    companyId: string,
  ): Promise<ActiveRoleAssignment[]>;
  // Todos los usuarios con el role asignado, activos o no.
  findUserIdsWithRole(roleId: string, companyId: string): Promise<string[]>;
}
