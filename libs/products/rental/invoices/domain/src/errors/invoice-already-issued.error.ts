import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - INVOICE_ALREADY_ISSUED (409, INV-023) - una Invoice
// activa (no Voided) ya existe para esta Reservation. Lanzado desde infrastructure/ al
// capturar la violacion del indice unico parcial, mismo patron que PaymentAlreadyProcessedError.
export class InvoiceAlreadyIssuedError extends DomainError {
  constructor(reservationId: string) {
    super(`Ya existe una invoice activa para la reservation "${reservationId}".`);
  }
}
