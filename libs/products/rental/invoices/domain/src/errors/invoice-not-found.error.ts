import { DomainError } from '@platform/shared-kernel';

export class InvoiceNotFoundError extends DomainError {
  constructor(invoiceId: string) {
    super(`No existe la invoice "${invoiceId}".`);
  }
}
