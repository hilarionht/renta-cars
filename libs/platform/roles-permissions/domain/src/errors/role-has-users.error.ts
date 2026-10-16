import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140 (decision del usuario): no se desactiva un role con
// usuarios asignados (perderian esos permisos sin enterarse). Primero hay que reasignarlos.
export class RoleHasUsersError extends DomainError {
  constructor(roleId: string, userIds: string[]) {
    super(`El role "${roleId}" esta asignado a usuarios: ${userIds.join(', ')}.`);
  }
}
