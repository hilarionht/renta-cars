import type { ChargeKindValue } from '@rental/invoices/domain';

export interface IssueInvoiceChargeInput {
  kind: ChargeKindValue;
  amountMinorUnits: number;
  currency: string;
  description: string;
}

// El listener de infrastructure ya tradujo priceBreakdown -> charges[] (ACL,
// docs/model/01-BOUNDED_CONTEXTS.md SS4.3) antes de invocar este comando - Invoice nunca
// decide montos por si misma (INV-110).
export interface IssueInvoiceCommand {
  companyId: string;
  reservationId: string;
  customerId: string;
  charges: IssueInvoiceChargeInput[];
}
