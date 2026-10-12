export interface ReservationCheckedOutEvent {
  eventType: 'ReservationCheckedOut.v1';
  reservationId: string;
  vehicleId: string;
  inspectionId: string;
  odometer: number;
}
