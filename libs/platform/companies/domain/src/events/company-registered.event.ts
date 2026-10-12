// docs/model/06-DOMAIN_EVENTS.md SS4 - payload conceptual de CompanyRegistered.v1.
export interface CompanyRegisteredEvent {
  eventType: 'CompanyRegistered.v1';
  companyId: string;
  legalName: string;
  taxId: string;
}
