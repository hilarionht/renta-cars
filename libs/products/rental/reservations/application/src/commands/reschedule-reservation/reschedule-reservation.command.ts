export interface RescheduleReservationCommand {
  companyId: string;
  reservationId: string;
  newStartDate: Date;
  newEndDate: Date;
}
