export interface CancelReservationCommand {
  companyId: string;
  reservationId: string;
  cancelledBy: string;
}
