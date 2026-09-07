// docs/model/06-DOMAIN_EVENTS.md SS6.1 - payload conceptual de VehicleRegistered.v1.
export interface VehicleRegisteredEvent {
  eventType: 'VehicleRegistered.v1';
  vehicleId: string;
  branchId: string;
  licensePlate: string;
  vin: string;
  categoryId: string;
}
