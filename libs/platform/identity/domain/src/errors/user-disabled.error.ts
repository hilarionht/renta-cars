import { DomainError } from '@platform/shared-kernel';

// Clase propia de identity/ (no la de users/domain - type:domain de un modulo no puede
// importar type:domain de otro, tooling/eslint/boundaries.mjs) para el chequeo en tiempo de
// login. Mapea al mismo codigo USER_DISABLED (403) que la de users/, misma semantica,
// dueños de dominio distintos.
export class UserDisabledError extends DomainError {
  constructor(userId: string) {
    super(`El usuario "${userId}" esta deshabilitado.`);
  }
}
