import { DomainError } from '@platform/shared-kernel';

// Codigo TOTP presentado no coincide contra el MfaLoginChallenge Pending vigente - distinto
// de MfaChallengeNotFoundError (no hay challenge vigente en absoluto). Sin reutilizar
// TOKEN_INVALID (a diferencia de RefreshTokenReusedError): challengeId es opaco y generado
// por el servidor, no hay nada que enmascarar aca.
export class InvalidMfaCodeError extends DomainError {
  constructor() {
    super('Codigo invalido.');
  }
}
