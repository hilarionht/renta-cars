// Evento nuevo, no estaba en docs/model/06-DOMAIN_EVENTS.md SS3 - agregado junto con el
// campo RoleStatus (decision tomada con el usuario, ver docs/model/02-AGGREGATES.md SS2).
// Mismo criterio de auditoria que RolePermissionsChanged.v1 (docs/09-SEGURIDAD.md SS4).
export interface RoleDeactivatedEvent {
  eventType: 'RoleDeactivated.v1';
  roleId: string;
}
