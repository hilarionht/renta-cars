import { DomainError } from '@platform/shared-kernel';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - codigo TOTP presentado como prueba de
// posesion (enroll/confirm, disable) no coincide. Distinta de la clase homonima en
// identity/domain (verificacion de 2do factor en login) - moduleConstraints
// (tooling/eslint/boundaries.mjs) aisla el domain de cada modulo, asi que users/application
// no puede importar identity/domain aunque el concepto sea el mismo; mismo `code` de catalogo
// (MFA_CODE_INVALID) en los dos registries (mismo criterio de reuso que RESOURCE_NOT_FOUND).
export class InvalidMfaCodeError extends DomainError {
  constructor() {
    super('Codigo invalido.');
  }
}
