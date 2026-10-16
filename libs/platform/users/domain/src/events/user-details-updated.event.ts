// docs/persistence/10-DECISIONES.md #140: PATCH /users/:id (nombre y sucursal). Solo los campos
// que cambiaron; branchId null = el usuario deja de estar asignado a una sucursal.
export interface UserDetailsUpdatedEvent {
  eventType: 'UserDetailsUpdated.v1';
  userId: string;
  name?: string;
  branchId?: string | null;
}
