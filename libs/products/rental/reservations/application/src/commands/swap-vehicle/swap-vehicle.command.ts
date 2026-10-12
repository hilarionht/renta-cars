export interface SwapVehicleCommand {
  companyId: string;
  reservationId: string;
  newVehicleId: string;
  reason?: string;
}
