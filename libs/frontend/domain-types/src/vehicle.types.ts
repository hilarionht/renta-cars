// Verificado contra libs/products/rental/vehicles/infrastructure/src/http/dto/
// vehicle-summary-response.dto.ts (tambien lo que devuelve GET /vehicles). vehicleCategory
// presente solo cuando se pide ?expand=vehicleCategory (docs/persistence/10-DECISIONES.md
// #123, primera implementacion real del mecanismo expand).
export interface VehicleCategoryRef {
  id: string;
  name: string;
}

// docs/persistence/10-DECISIONES.md #137: reserva activa derivada en la lectura (el estado del
// vehiculo nunca pasa a Reserved/CheckedOut). Solo para el personal: con token de cliente
// (mobile) el API no la devuelve.
export interface VehicleReservationRef {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface VehicleSummary {
  id: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
  vehicleCategory?: VehicleCategoryRef;
  activeReservation?: VehicleReservationRef;
}
