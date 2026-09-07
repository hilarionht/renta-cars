import { DomainError } from '@platform/shared-kernel';

export class InvalidRoleAssignmentError extends DomainError {
  constructor(roleId: string) {
    super(`El role "${roleId}" no existe o no pertenece a esta company.`);
  }
}
