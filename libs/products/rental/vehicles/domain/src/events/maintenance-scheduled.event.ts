export interface MaintenanceScheduledEvent {
  eventType: 'MaintenanceScheduled.v1';
  vehicleId: string;
  maintenanceId: string;
  type: string;
  window: { start: string; end: string };
}
