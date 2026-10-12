// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de CustomerUnblocked.v1.
export interface CustomerUnblockedEvent {
  eventType: 'CustomerUnblocked.v1';
  customerId: string;
  unblockedBy: string;
}
