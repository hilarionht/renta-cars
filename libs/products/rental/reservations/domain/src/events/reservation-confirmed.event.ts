import type { PriceBreakdownPayload } from './price-breakdown-payload';

export interface ReservationConfirmedEvent {
  eventType: 'ReservationConfirmed.v1';
  reservationId: string;
  customerId: string;
  vehicleId: string;
  dateRange: { startDate: string; endDate: string };
  priceBreakdown: PriceBreakdownPayload;
}
