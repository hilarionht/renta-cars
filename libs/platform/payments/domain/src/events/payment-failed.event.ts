export interface PaymentFailedEvent {
  eventType: 'PaymentFailed.v1';
  paymentId: string;
  targetType: 'Invoice' | 'SecurityDeposit';
  targetId: string;
  reason: string;
}
