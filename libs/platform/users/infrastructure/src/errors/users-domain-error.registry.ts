import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import {
  CompanyNotFoundError,
  DuplicateEmailError,
  InvalidBranchAssignmentError,
  InvalidMfaCodeError,
  InvalidRoleAssignmentError,
  PasswordResetTokenInvalidError,
  UserDisabledError,
  UserNotFoundError,
} from '@platform/users/domain';

export const USERS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #139 (patron de #137): VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  [UserDisabledError, { status: 403, code: 'USER_DISABLED', title: 'Usuario deshabilitado' }],
  [UserNotFoundError, { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Usuario no encontrado' }],
  [DuplicateEmailError, { status: 409, code: 'RESOURCE_CONFLICT', title: 'Email duplicado' }],
  [CompanyNotFoundError, { status: 422, code: 'VALIDATION_FAILED', title: 'Company inexistente' }],
  [InvalidRoleAssignmentError, { status: 422, code: 'VALIDATION_FAILED', title: 'Role invalido' }],
  // #140: sucursal inexistente o cerrada al crear o editar un usuario.
  [
    InvalidBranchAssignmentError,
    { status: 422, code: 'INVALID_BRANCH_ASSIGNMENT', title: 'Sucursal invalida para el usuario' },
  ],
  [InvalidMfaCodeError, { status: 401, code: 'MFA_CODE_INVALID', title: 'Codigo MFA invalido' }],
  [
    PasswordResetTokenInvalidError,
    { status: 401, code: 'PASSWORD_RESET_TOKEN_INVALID', title: 'Token de recuperacion invalido' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
