export interface VehicleSwappedEvent {
  eventType: 'VehicleSwapped.v1';
  reservationId: string;
  previousVehicleId: string;
  newVehicleId: string;
  reason?: string;
}
