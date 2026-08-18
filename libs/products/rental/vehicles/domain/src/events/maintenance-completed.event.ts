export interface MaintenanceCompletedEvent {
  eventType: 'MaintenanceCompleted.v1';
  vehicleId: string;
  maintenanceId: string;
  fitForService: boolean;
}
