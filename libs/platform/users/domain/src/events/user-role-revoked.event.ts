// docs/persistence/10-DECISIONES.md #140: antes no habia evento y la accion no quedaba en la
// auditoria (el listener de audit transcribe cualquier evento de dominio).
export interface UserRoleRevokedEvent {
  eventType: 'UserRoleRevoked.v1';
  userId: string;
  roleId: string;
}
