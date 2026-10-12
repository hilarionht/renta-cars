export interface VehicleStatusChangedEvent {
  eventType: 'VehicleStatusChanged.v1';
  vehicleId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}
