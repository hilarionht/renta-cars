// docs/model/06-DOMAIN_EVENTS.md SS3 - payload conceptual de UserCreated.v1.
export interface UserCreatedEvent {
  eventType: 'UserCreated.v1';
  userId: string;
  companyId: string;
  branchId?: string;
  email: string;
  roles: string[];
}
