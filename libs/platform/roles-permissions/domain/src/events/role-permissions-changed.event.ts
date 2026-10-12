// docs/model/06-DOMAIN_EVENTS.md SS3 - payload conceptual de RolePermissionsChanged.v1.
export interface RolePermissionsChangedEvent {
  eventType: 'RolePermissionsChanged.v1';
  roleId: string;
  addedPermissions: string[];
  removedPermissions: string[];
}
