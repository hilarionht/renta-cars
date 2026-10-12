export interface ScheduleMaintenanceCommand {
  vehicleId: string;
  companyId: string;
  type: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  responsibleUserId?: string;
}
