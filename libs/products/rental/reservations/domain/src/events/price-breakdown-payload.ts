// Forma serializable de PriceBreakdown/PriceAdjustment (docs/model/04-VALUE_OBJECTS.md
// SS5.2) usada en el payload de los eventos que la transportan - nunca el VO/entidad en si.
export interface PriceAdjustmentPayload {
  kind: string;
  amountMinorUnits: number;
  currency: string;
  reason?: string;
}

export interface PriceBreakdownPayload {
  baseAmountMinorUnits: number;
  currency: string;
  adjustments: PriceAdjustmentPayload[];
}
