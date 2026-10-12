export interface CustomerSessionRevokedEvent {
  eventType: 'CustomerSessionRevoked.v1';
  customerSessionId: string;
  customerId: string;
  reason: string;
}
