// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de CustomerRegistered.v1.
export interface CustomerRegisteredEvent {
  eventType: 'CustomerRegistered.v1';
  customerId: string;
  companyId: string;
  customerType: string;
}
