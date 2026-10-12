// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de CustomerDocumentValidated.v1.
// Reutilizado genericamente para CUALQUIER IdentityDocument verificado, sea del propio
// Customer o de uno de sus AdditionalDriver - el payload no distingue propietario, mismo
// criterio de generalidad ya usado en el resto del catalogo (ver docs/persistence/
// 10-DECISIONES.md).
export interface CustomerDocumentValidatedEvent {
  eventType: 'CustomerDocumentValidated.v1';
  customerId: string;
  documentId: string;
  documentType: string;
}
