import { DomainError } from '@platform/shared-kernel';

// INV-018 (docs/model/07-INVARIANTS.md): EnabledProductModules nunca vacio.
export class EnabledProductModulesEmptyError extends DomainError {
  constructor() {
    super('EnabledProductModules no puede quedar vacio.');
  }
}
