import { DomainError } from '@platform/shared-kernel';

// docs/persistence/05-INDICES-Y-CONSTRAINTS.md: (company_id, role_name) unico para
// scope=Custom (role_name solo unico para scope=System, caso separado que este error no
// cubre - un roleName de System nunca se crea via CreateRole, solo via el seed).
export class DuplicateRoleNameError extends DomainError {
  constructor(roleName: string) {
    super(`Ya existe un role llamado "${roleName}" en esta company.`);
  }
}
