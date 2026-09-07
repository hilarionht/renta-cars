import { DomainError } from '@platform/shared-kernel';

// docs/model/04-VALUE_OBJECTS.md SS6: catalogo cerrado de 4 metodos de pago.
export class InvalidPaymentMethodError extends DomainError {
  constructor(value: string) {
    super(`Metodo de pago invalido: "${value}".`);
  }
}
