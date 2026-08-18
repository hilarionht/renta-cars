// Puerto publico forward-looking - Reservation (Fase 1 item 4, no construido todavia) lo
// consumira para INV-103 ("un Vehicle en Maintenance/OutOfService no puede ofrecerse
// disponible ni completar CheckOut", docs/model/09-DEPENDENCIES.md SS2). Superficie minima
// de solo lectura, mismo patron que CUSTOMER_LOOKUP_PORT.
export const VEHICLE_STATUS_PORT = Symbol('VehicleStatusPort');

export interface VehicleStatusPort {
  // null = el vehicle no existe. false si status es Maintenance/OutOfService.
  isOperational(vehicleId: string): Promise<boolean | null>;
}
