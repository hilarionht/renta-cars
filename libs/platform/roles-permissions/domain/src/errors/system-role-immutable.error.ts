import { DomainError } from '@platform/shared-kernel';

// INV-026 (docs/model/07-INVARIANTS.md SS1): un Role de alcance System no es editable ni
// eliminable - ninguna mutacion (editPermissions, deactivate) se le puede aplicar.
export class SystemRoleImmutableError extends DomainError {
  constructor(roleId: string) {
    super(`El role "${roleId}" es de alcance System y no puede modificarse.`);
  }
}
