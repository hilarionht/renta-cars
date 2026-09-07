import { DomainError } from '@platform/shared-kernel';

export class InvalidPaymentMethodError extends DomainError {
  constructor(value: string) {
    super(
      `"${value}" no es un PaymentMethod valido (catalogo cerrado: Card, Cash, Transfer, DigitalWallet).`,
    );
  }
}
