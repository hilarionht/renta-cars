import type { PriceAdjustmentPayload } from './price-breakdown-payload';

export interface ReservationCancelledEvent {
  eventType: 'ReservationCancelled.v1';
  reservationId: string;
  customerId: string;
  cancelledBy: string;
  penaltyApplied?: PriceAdjustmentPayload;
}
