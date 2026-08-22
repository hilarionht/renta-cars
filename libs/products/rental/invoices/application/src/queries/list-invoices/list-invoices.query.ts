import type { InvoiceSummary } from '../get-invoice/get-invoice.query';

export interface ListInvoicesQuery {
  companyId: string;
  reservationId?: string;
}

export interface ListInvoicesResult {
  items: InvoiceSummary[];
}
