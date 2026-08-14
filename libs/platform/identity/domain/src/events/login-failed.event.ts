// Gap encontrado en esta tanda: docs/model/06-DOMAIN_EVENTS.md SS3 no tenia ningun evento
// para el camino de login fallido, pese a que docs/09-SEGURIDAD.md SS4 exige auditar
// "login exitoso/fallido" explicitamente - solo SessionCreated.v1 cubria el exito. Se agrega
// aca y al catalogo de docs/model/ en el mismo cambio (nunca despues).
export interface LoginFailedEvent {
  eventType: 'LoginFailed.v1';
  email: string;
  companyId?: string;
  reason: 'unknown_email' | 'invalid_password' | 'user_disabled';
}
