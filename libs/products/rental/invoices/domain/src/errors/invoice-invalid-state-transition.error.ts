import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS4 - transiciones explicitamente invalidas de Invoice.
export class InvoiceInvalidStateTransitionError extends DomainError {
  constructor(invoiceId: string, from: string, action: string) {
    super(`La invoice "${invoiceId}" no puede "${action}" estando en estado "${from}".`);
  }
}
