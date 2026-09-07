export interface RateChangedEvent {
  eventType: 'RateChanged.v1';
  categoryId: string;
  rateId: string;
  amount: { minorUnits: number; currency: string };
  validFrom: string;
}
