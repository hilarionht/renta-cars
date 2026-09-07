// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de AdditionalDriverRegistered.v1.
export interface AdditionalDriverRegisteredEvent {
  eventType: 'AdditionalDriverRegistered.v1';
  customerId: string;
  driverId: string;
}
