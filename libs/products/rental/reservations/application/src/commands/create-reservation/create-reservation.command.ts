export interface CreateReservationCommand {
  companyId: string;
  customerId: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  authorizedDriverIds?: string[];
}
