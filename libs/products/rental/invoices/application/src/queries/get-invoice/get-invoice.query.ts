export interface GetInvoiceQuery {
  companyId: string;
  invoiceId: string;
}

export interface InvoiceChargeSummary {
  id: string;
  kind: string;
  amountMinorUnits: number;
  currency: string;
  description: string;
}

export interface InvoiceSummary {
  id: string;
  reservationId: string;
  customerId: string;
  invoiceNumber: string;
  status: string;
  taxAmountMinorUnits: number;
  totalMinorUnits: number;
  currency: string;
  voidReason?: string;
  charges: InvoiceChargeSummary[];
}
