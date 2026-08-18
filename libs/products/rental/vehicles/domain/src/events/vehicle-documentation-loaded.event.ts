export interface VehicleDocumentationLoadedEvent {
  eventType: 'VehicleDocumentationLoaded.v1';
  vehicleId: string;
  documentId: string;
  documentType: string;
  validUntil: string;
}
