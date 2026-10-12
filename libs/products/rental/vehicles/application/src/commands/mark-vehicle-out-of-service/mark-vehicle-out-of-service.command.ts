export interface MarkVehicleOutOfServiceCommand {
  vehicleId: string;
  companyId: string;
  reason?: string;
}
