export interface GetVehicleQuery {
  vehicleId: string;
  companyId: string;
}

export interface VehicleDocumentSummary {
  id: string;
  documentType: string;
  fileId: string;
  expiryDate: string;
  status: string;
}

export interface MaintenanceRecordSummary {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  fitForService?: boolean;
}

export interface VehicleDetail {
  id: string;
  companyId: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
  vehicleDocuments: VehicleDocumentSummary[];
  maintenanceRecords: MaintenanceRecordSummary[];
}

export interface ListVehiclesQuery {
  companyId: string;
  branchId?: string;
  status?: string;
  // docs/persistence/10-DECISIONES.md #116: busqueda por disponibilidad - ambos o ninguno
  // (validado en ListVehiclesHandler, no en el tipo). Cuando estan presentes, status (arriba)
  // se ignora - se fuerza a la flota operable y se descartan los ocupados en el rango.
  startDate?: Date;
  endDate?: Date;
  // docs/contracts/10-DECISIONES.md #3, primera implementacion real de `?expand=` - unico
  // valor soportado hoy: 'vehicleCategory' (docs/persistence/10-DECISIONES.md #123).
  expand?: string[];
}

export interface VehicleSummary {
  id: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
  // Presente solo si se pidio expand: ['vehicleCategory'] (docs/persistence/
  // 10-DECISIONES.md #123) - proyeccion minima, no VehicleCategorySummary (get-vehicle-
  // category.query.ts, que incluye description y es una query distinta).
  vehicleCategory?: { id: string; name: string };
}
