import type { PaymentSummary } from '../get-payment/get-payment.query';

export interface ListPaymentsQuery {
  companyId: string;
  targetType?: string;
  targetId?: string;
}

export interface ListPaymentsResult {
  items: PaymentSummary[];
}
