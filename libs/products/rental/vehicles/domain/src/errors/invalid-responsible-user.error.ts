import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #142: el responsable de un mantenimiento tiene que ser un
// usuario activo de la misma company (antes se aceptaba cualquier UUID: de otra company,
// inexistente o deshabilitado). Mismo criterio que INVALID_BRANCH_ASSIGNMENT (#140).
export class InvalidResponsibleUserError extends DomainError {
  constructor(userId: string, reason: 'not-found' | 'inactive') {
    super(
      reason === 'inactive'
        ? `El usuario "${userId}" esta deshabilitado: no puede ser responsable de un mantenimiento.`
        : `El usuario "${userId}" no existe en la company.`,
    );
  }
}
