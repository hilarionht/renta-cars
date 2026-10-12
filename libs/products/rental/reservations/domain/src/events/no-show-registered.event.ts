import type { PriceAdjustmentPayload } from './price-breakdown-payload';

export interface NoShowRegisteredEvent {
  eventType: 'NoShowRegistered.v1';
  reservationId: string;
  penaltyApplied?: PriceAdjustmentPayload;
}
