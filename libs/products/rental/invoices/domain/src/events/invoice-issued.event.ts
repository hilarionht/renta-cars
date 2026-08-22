export interface InvoiceIssuedChargePayload {
  kind: string;
  amountMinorUnits: number;
  currency: string;
  description: string;
}

export interface InvoiceIssuedEvent {
  eventType: 'InvoiceIssued.v1';
  invoiceId: string;
  reservationId: string;
  customerId: string;
  invoiceNumber: string;
  charges: InvoiceIssuedChargePayload[];
  total: { minorUnits: number; currency: string };
}
