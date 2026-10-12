// docs/model/06-DOMAIN_EVENTS.md SS3 - payload conceptual de RoleCreated.v1.
export interface RoleCreatedEvent {
  eventType: 'RoleCreated.v1';
  roleId: string;
  companyId: string | null;
  scope: string;
}
