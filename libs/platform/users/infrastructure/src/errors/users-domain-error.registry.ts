import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  CompanyNotFoundError,
  DuplicateEmailError,
  InvalidMfaCodeError,
  InvalidRoleAssignmentError,
  PasswordResetTokenInvalidError,
  UserDisabledError,
  UserNotFoundError,
} from '@platform/users/domain';

export const USERS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [UserDisabledError, { status: 403, code: 'USER_DISABLED', title: 'Usuario deshabilitado' }],
  [UserNotFoundError, { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Usuario no encontrado' }],
  [DuplicateEmailError, { status: 409, code: 'RESOURCE_CONFLICT', title: 'Email duplicado' }],
  [CompanyNotFoundError, { status: 422, code: 'VALIDATION_FAILED', title: 'Company inexistente' }],
  [InvalidRoleAssignmentError, { status: 422, code: 'VALIDATION_FAILED', title: 'Role invalido' }],
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
