// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de CustomerBlocked.v1.
export interface CustomerBlockedEvent {
  eventType: 'CustomerBlocked.v1';
  customerId: string;
  reason: string;
}
