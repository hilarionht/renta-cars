// Verificado contra libs/products/rental/vehicles/infrastructure/src/http/dto/
// vehicle-summary-response.dto.ts (tambien lo que devuelve GET /vehicles). vehicleCategory
// presente solo cuando se pide ?expand=vehicleCategory (docs/persistence/10-DECISIONES.md
// #123, primera implementacion real del mecanismo expand).
export interface VehicleCategoryRef {
  id: string;
  name: string;
}

export interface VehicleSummary {
  id: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
  vehicleCategory?: VehicleCategoryRef;
}
