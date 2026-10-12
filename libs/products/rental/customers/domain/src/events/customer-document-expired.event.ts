// docs/model/06-DOMAIN_EVENTS.md SS6.2 - payload conceptual de CustomerDocumentExpired.v1.
// Tipado por compatibilidad futura pero nunca emitido en esta tanda - la transicion es
// "automatica, por fecha", y no existe ningun job de vigencia que la dispare (mismo gap ya
// aceptado para OutboxRelayWorker: se construye cuando exista un escenario real que lo
// necesite).
export interface CustomerDocumentExpiredEvent {
  eventType: 'CustomerDocumentExpired.v1';
  customerId: string;
  documentId: string;
}
