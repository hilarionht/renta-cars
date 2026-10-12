import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - INVOICE_NOT_YET_ISSUED (409, INV-005/INV-108/RN-22)
// - close() sin InvoiceIssued.v1 recibido. En esta tanda no existe ningun listener que
// dispare close() (Invoice es Commerce/Fase 2) - este error solo protege el metodo de
// dominio contra un intento directo prematuro.
export class InvoiceNotYetIssuedError extends DomainError {
  constructor(reservationId: string) {
    super(`La reservation "${reservationId}" no puede cerrarse sin una Invoice emitida.`);
  }
}
