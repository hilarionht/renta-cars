export interface SecurityDepositPartiallyRetainedEvent {
  eventType: 'SecurityDepositPartiallyRetained.v1';
  depositId: string;
  reservationId: string;
  retainedAmount: { minorUnits: number; currency: string };
  reason: string;
}
