export interface SecurityDepositReleasedEvent {
  eventType: 'SecurityDepositReleased.v1';
  depositId: string;
  reservationId: string;
}
