// Puerto publico forward-looking - Reservation (Fase 1 item 4, no construido todavia) lo
// consumira para obtener la Rate vigente al cotizar/confirmar (docs/model/
// 09-DEPENDENCIES.md SS2, RN-20).
export const VEHICLE_CATEGORY_LOOKUP_PORT = Symbol('VehicleCategoryLookupPort');

export interface CurrentRate {
  amountMinorUnits: number;
  currency: string;
  unit: string;
}

export interface VehicleCategoryLookupPort {
  // null = no existe la categoria, o no tiene ninguna Rate vigente a `asOf`.
  getCurrentRate(categoryId: string, asOf: Date): Promise<CurrentRate | null>;
}
