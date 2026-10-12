// Evento nuevo, no estaba en docs/model/06-DOMAIN_EVENTS.md SS6.2 - el catalogo solo tenia
// AdditionalDriverRegistered.v1 (alta), pero validate-license es una operacion de negocio
// nombrada en docs/contracts/02-RESOURCE-CATALOG.md sin evento propio. Agregado siguiendo
// el mismo criterio ya usado para RoleDeactivated.v1 (encontrado durante la implementacion,
// documentado en el mismo commit).
export interface AdditionalDriverValidatedEvent {
  eventType: 'AdditionalDriverValidated.v1';
  customerId: string;
  driverId: string;
}
