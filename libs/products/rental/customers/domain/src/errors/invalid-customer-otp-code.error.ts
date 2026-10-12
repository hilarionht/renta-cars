import { DomainError } from '@platform/shared-kernel';

// Codigo presentado no coincide con el CustomerOtpChallenge Pending vigente - distinto de
// OtpChallengeNotFoundError (no hay challenge vigente en absoluto). No revela cuantos
// intentos quedan - el agotamiento de intentos se traduce en el mismo
// OtpChallengeNotFoundError que "nunca se pidio un codigo" (ver ese archivo).
export class InvalidCustomerOtpCodeError extends DomainError {
  constructor() {
    super('Codigo invalido.');
  }
}
