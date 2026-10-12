export interface CloseReservationCommand {
  companyId: string;
  reservationId: string;
  // Sin listener real esta tanda (InvoiceIssued.v1 nunca se publica hasta Commerce/Fase 2,
  // Hallazgo #10 del plan de implementacion) - el llamador debe proveerlo explicitamente.
  hasInvoiceIssued: boolean;
}
