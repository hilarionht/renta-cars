// docs/model/06-DOMAIN_EVENTS.md SS4 - payload conceptual de CompanySuspended.v1.
export interface CompanySuspendedEvent {
  eventType: 'CompanySuspended.v1';
  companyId: string;
  reason: string;
}
