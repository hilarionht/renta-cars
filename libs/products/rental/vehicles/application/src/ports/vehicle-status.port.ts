// Puerto publico consumido por Reservation - INV-103 ("un Vehicle en Maintenance/
// OutOfService no puede ofrecerse disponible ni completar CheckOut", docs/model/
// 09-DEPENDENCIES.md SS2). Superficie minima de solo lectura, mismo patron que
// CUSTOMER_LOOKUP_PORT. getBranchId agregado (docs/persistence/10-DECISIONES.md #59) -
// Reservation no contiene branchId (docs/model/02-AGGREGATES.md SS11: "solo CustomerId/
// VehicleId"), asi que Reservation.checkOut() encadena getBranchId() -> BranchLookupPort
// (INV-112) en su propia capa de aplicacion.
export const VEHICLE_STATUS_PORT = Symbol('VehicleStatusPort');

export interface VehicleStatusPort {
  // null = el vehicle no existe. false si status es Maintenance/OutOfService.
  isOperational(vehicleId: string): Promise<boolean | null>;
  // null = el vehicle no existe.
  getBranchId(vehicleId: string): Promise<string | null>;
  // null = el vehicle no existe. Necesario para que PricingService resuelva la Rate
  // vigente (VEHICLE_CATEGORY_LOOKUP_PORT.getCurrentRate toma categoryId, no vehicleId).
  getCategoryId(vehicleId: string): Promise<string | null>;
}
