export interface GetPaymentQuery {
  companyId: string;
  paymentId: string;
}

export interface PaymentSummary {
  id: string;
  targetType: string;
  targetId: string;
  amountMinorUnits: number;
  currency: string;
  method: string;
  status: string;
  gatewayReference?: string;
  idempotencyKey: string;
  failureReason?: string;
}
