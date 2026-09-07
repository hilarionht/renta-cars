// Evento nuevo, mismo criterio que AdditionalDriverValidated.v1 - revoke tampoco tenia
// evento propio en el catalogo.
export interface AdditionalDriverRevokedEvent {
  eventType: 'AdditionalDriverRevoked.v1';
  customerId: string;
  driverId: string;
}
