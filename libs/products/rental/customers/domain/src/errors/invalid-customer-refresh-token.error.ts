import { DomainError } from '@platform/shared-kernel';

// Espejo de libs/platform/identity/domain/src/errors/invalid-refresh-token.error.ts -
// duplicado a proposito, ver customer-session.ts. Token desconocido (nunca existio, o el
// hash no matchea ninguna CustomerSession) - distinto de CustomerRefreshTokenReusedError
// (token que SI existio pero ya no esta Active), aunque ambos mapean al mismo codigo HTTP
// TOKEN_INVALID (401) - nunca se distingue al cliente cual de los dos ocurrio.
export class InvalidCustomerRefreshTokenError extends DomainError {
  constructor() {
    super('Refresh token invalido.');
  }
}
