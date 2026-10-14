export class VehicleDocumentResponseDto {
  id!: string;
  documentType!: string;
  fileId!: string;
  expiryDate!: string;
  status!: string;
}

export class MaintenanceRecordResponseDto {
  id!: string;
  type!: string;
  status!: string;
  scheduledStart!: string;
  scheduledEnd!: string;
  fitForService?: boolean;
}

export class VehicleResponseDto {
  id!: string;
  companyId!: string;
  branchId!: string;
  vehicleCategoryId!: string;
  licensePlate!: string;
  vin!: string;
  status!: string;
  vehicleDocuments!: VehicleDocumentResponseDto[];
  maintenanceRecords!: MaintenanceRecordResponseDto[];
  // Solo para el personal (docs/persistence/10-DECISIONES.md #137).
  activeReservations?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    overdue: boolean;
  }[];
}
