import { DomainError } from '@platform/shared-kernel';

// Token desconocido (nunca existio, o el hash no matchea ninguna Session) - distinto de
// RefreshTokenReusedError (token que SI existio pero ya no esta Active), aunque ambos
// mapean al mismo codigo HTTP TOKEN_INVALID (401) - nunca se distingue al cliente cual de
// los dos ocurrio.
export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('Refresh token invalido.');
  }
}
