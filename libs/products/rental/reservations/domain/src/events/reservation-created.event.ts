export interface ReservationCreatedEvent {
  eventType: 'ReservationCreated.v1';
  reservationId: string;
  customerId: string;
  vehicleId: string;
  dateRange: { startDate: string; endDate: string };
  status: 'Draft';
}
