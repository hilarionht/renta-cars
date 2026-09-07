export interface ExtensionRequestedEvent {
  eventType: 'ExtensionRequested.v1';
  reservationId: string;
  requestedNewEndDate: string;
}
