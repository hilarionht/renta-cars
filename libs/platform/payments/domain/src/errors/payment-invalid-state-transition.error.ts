import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS3.2: transiciones explicitamente invalidas de Payment.
export class PaymentInvalidStateTransitionError extends DomainError {
  constructor(paymentId: string, from: string, action: string) {
    super(`El payment "${paymentId}" no puede "${action}" estando en estado "${from}".`);
  }
}
