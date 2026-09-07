import { DomainError } from '@platform/shared-kernel';

// Falla tecnica/de conectividad de la pasarela (distinta de un rechazo de negocio, ver
// PaymentGatewayDeclinedError) - el Payment permanece en su estado previo (Requested/
// Authorized/Captured) para permitir reintento, nunca transiciona a Failed.
export class PaymentGatewayUnavailableError extends DomainError {
  constructor(provider: string, cause: string) {
    super(`La pasarela de pago "${provider}" no esta disponible: ${cause}`);
  }
}
