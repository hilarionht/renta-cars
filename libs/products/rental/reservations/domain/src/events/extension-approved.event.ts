import type { PriceBreakdownPayload } from './price-breakdown-payload';

export interface ExtensionApprovedEvent {
  eventType: 'ExtensionApproved.v1';
  reservationId: string;
  newRange: { startDate: string; endDate: string };
  priceBreakdown: PriceBreakdownPayload;
}
