export interface CustomerSessionCreatedEvent {
  eventType: 'CustomerSessionCreated.v1';
  customerSessionId: string;
  customerId: string;
  deviceUserAgent?: string;
  deviceIpAddress?: string;
}
