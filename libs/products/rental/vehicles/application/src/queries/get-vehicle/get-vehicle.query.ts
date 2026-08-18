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
}

export interface VehicleSummary {
  id: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: string;
}
