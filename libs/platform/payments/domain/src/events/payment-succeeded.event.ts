export interface PaymentSucceededEvent {
  eventType: 'PaymentSucceeded.v1';
  paymentId: string;
  targetType: 'Invoice' | 'SecurityDeposit';
  targetId: string;
  amount: { minorUnits: number; currency: string };
  method: string;
}
