export interface ReservationRejectedByAvailabilityEvent {
  eventType: 'ReservationRejectedByAvailability.v1';
  reservationId: string;
  vehicleId: string;
  dateRange: { startDate: string; endDate: string };
}
