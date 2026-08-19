export interface CheckOutReservationCommand {
  companyId: string;
  reservationId: string;
  odometer: number;
  fuelLevelPercentage: number;
  photoFileIds: string[];
  inspectedBy: string;
}
