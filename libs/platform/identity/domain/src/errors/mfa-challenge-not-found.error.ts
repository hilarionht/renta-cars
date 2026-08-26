import { DomainError } from '@platform/shared-kernel';

// Ningun MfaLoginChallenge Pending y no-expirado para el challengeId presentado - cubre
// tanto "el challenge nunca existio" como "expiro" bajo un unico caso, mismo criterio que
// OtpChallengeNotFoundError.
export class MfaChallengeNotFoundError extends DomainError {
  constructor() {
    super('El desafio de verificacion ya no es valido - inicia sesion de nuevo.');
  }
}
