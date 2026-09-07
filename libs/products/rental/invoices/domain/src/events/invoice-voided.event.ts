export interface InvoiceVoidedEvent {
  eventType: 'InvoiceVoided.v1';
  invoiceId: string;
  reason: string;
}
