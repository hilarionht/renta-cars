export interface PaymentRefundedEvent {
  eventType: 'PaymentRefunded.v1';
  paymentId: string;
  amount: { minorUnits: number; currency: string };
}
