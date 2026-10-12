import { DomainError } from '@platform/shared-kernel';

// docs/model/04-VALUE_OBJECTS.md SS3: PaymentMethodsEnabled requiere "al menos un metodo
// habilitado".
export class PaymentMethodsEmptyError extends DomainError {
  constructor() {
    super('PaymentMethodsEnabled no puede quedar vacio.');
  }
}
