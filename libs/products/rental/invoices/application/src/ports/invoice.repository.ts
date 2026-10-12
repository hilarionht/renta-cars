import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Invoice, InvoiceId } from '@rental/invoices/domain';

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');

export interface InvoiceRepository {
  findById(id: InvoiceId): Promise<Invoice | null>;
  // Usado por IssueInvoiceHandler para el guard de idempotencia (INV-023) y por el listener
  // de reservations que necesita el invoiceId tras emitirse - a lo sumo una Invoice activa
  // (status != 'Voided') por reservationId, protegido tambien por el indice unico parcial.
  findByReservationId(reservationId: string): Promise<Invoice | null>;
  save(invoice: Invoice, tx: UnitOfWorkTransaction): Promise<void>;
}
