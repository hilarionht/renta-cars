import type { PriceBreakdownPayload } from './price-breakdown-payload';

export interface ReservationCheckedInEvent {
  eventType: 'ReservationCheckedIn.v1';
  reservationId: string;
  vehicleId: string;
  inspectionId: string;
  priceBreakdown: PriceBreakdownPayload;
}
