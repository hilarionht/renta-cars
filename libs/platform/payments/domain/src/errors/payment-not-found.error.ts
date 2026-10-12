import { DomainError } from '@platform/shared-kernel';

export class PaymentNotFoundError extends DomainError {
  constructor(paymentId: string) {
    super(`No existe el payment "${paymentId}".`);
  }
}
