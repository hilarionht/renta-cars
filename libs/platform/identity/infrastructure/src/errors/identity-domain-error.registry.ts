import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  InvalidCredentialsError,
  InvalidMfaCodeError,
  InvalidRefreshTokenError,
  MfaChallengeNotFoundError,
  RefreshTokenReusedError,
  UserDisabledError,
} from '@platform/identity/domain';

// INVALID_CREDENTIALS: gap encontrado en esta tanda, agregado al catalogo (docs/contracts/
// 07-ERROR-CATALOG.md) en el mismo cambio que este codigo, per la regla del propio catalogo
// (SS7: nunca un codigo inventado sin agregarlo primero). El camino de robo de refresh
// token (RefreshTokenReusedError) reutiliza TOKEN_INVALID a proposito - nunca un codigo
// distinto que revele al cliente que se detecto un reuso (decision de esta tanda).
export const IDENTITY_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    InvalidCredentialsError,
    { status: 401, code: 'INVALID_CREDENTIALS', title: 'Credenciales invalidas' },
  ],
  [UserDisabledError, { status: 403, code: 'USER_DISABLED', title: 'Usuario deshabilitado' }],
  [InvalidRefreshTokenError, { status: 401, code: 'TOKEN_INVALID', title: 'Token invalido' }],
  [RefreshTokenReusedError, { status: 401, code: 'TOKEN_INVALID', title: 'Token invalido' }],
  [InvalidMfaCodeError, { status: 401, code: 'MFA_CODE_INVALID', title: 'Codigo MFA invalido' }],
  [
    MfaChallengeNotFoundError,
    { status: 401, code: 'MFA_CHALLENGE_NOT_FOUND', title: 'Desafio MFA no encontrado' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
