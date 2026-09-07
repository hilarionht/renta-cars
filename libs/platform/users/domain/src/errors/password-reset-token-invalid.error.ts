import { DomainError } from '@platform/shared-kernel';

// Recuperacion de contraseña (docs/persistence/10-DECISIONES.md #113) - colapsa 3 causas
// distintas (token no existe / ya fue usado / expiro) bajo un unico codigo, mismo criterio
// que OtpChallengeNotFoundError/MfaChallengeNotFoundError - ninguna se distingue al cliente.
export class PasswordResetTokenInvalidError extends DomainError {
  constructor() {
    super('El token de recuperacion no es valido - solicita uno nuevo.');
  }
}
