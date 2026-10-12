export interface SecurityDepositHeldEvent {
  eventType: 'SecurityDepositHeld.v1';
  depositId: string;
  reservationId: string;
  amount: { minorUnits: number; currency: string };
}
