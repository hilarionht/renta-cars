import { DomainError } from '@platform/shared-kernel';

// Vive en application/, no en domain/: representa un desenlace de I/O (la pasarela rechazo la
// operacion), no una regla de negocio del aggregate Payment - los adaptadores de
// integration-providers/infrastructure la lanzan (pueden depender de type:application de
// cualquier modulo, pero no de type:domain de otro modulo, tooling/eslint/boundaries.mjs). El
// command handler la captura, persiste Payment.fail(), y la relanza para que
// PAYMENT_DECLINED (402) llegue al cliente.
export class PaymentGatewayDeclinedError extends DomainError {
  constructor(reason: string) {
    super(reason);
  }
}
