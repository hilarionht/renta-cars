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
}

export interface VehicleSummary {
  id: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
}
