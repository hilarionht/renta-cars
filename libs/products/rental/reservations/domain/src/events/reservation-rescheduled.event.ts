import type { PriceBreakdownPayload } from './price-breakdown-payload';

export interface ReservationRescheduledEvent {
  eventType: 'ReservationRescheduled.v1';
  reservationId: string;
  previousRange: { startDate: string; endDate: string };
  newRange: { startDate: string; endDate: string };
  priceBreakdown: PriceBreakdownPayload;
}
