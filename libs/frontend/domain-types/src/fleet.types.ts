// Tipos de la web de administracion, modulo Flota (docs/persistence/10-DECISIONES.md #137).
// Escritos a mano y verificados contra el backend:
//   - libs/products/rental/vehicles/application/src/queries/get-vehicle/get-vehicle.query.ts;
//   - libs/products/rental/vehicles/infrastructure/src/http/dto/*.ts (requests y respuestas);
//   - prisma/schema/rental.prisma (enums).
import type { VehicleReservationRef } from './vehicle.types';

// prisma/schema/rental.prisma, enum VehicleStatus.
export type VehicleStatus =
  'Registered' | 'Available' | 'Reserved' | 'CheckedOut' | 'Maintenance' | 'OutOfService';

// upload-vehicle-document-request.dto.ts (DOCUMENT_TYPES).
export type VehicleDocumentType = 'PropertyCard' | 'Insurance' | 'CirculationPermit';

export interface VehicleDocument {
  id: string;
  documentType: VehicleDocumentType;
  fileId: string;
  expiryDate: string;
  status: string;
}

// schedule-maintenance-request.dto.ts (MAINTENANCE_TYPES).
export type MaintenanceType = 'Preventive' | 'Corrective';

export interface MaintenanceRecord {
  id: string;
  type: MaintenanceType;
  status: 'Scheduled' | 'InProgress' | 'Completed';
  scheduledStart: string;
  scheduledEnd: string;
  fitForService?: boolean;
}

export interface VehicleActiveReservation extends VehicleReservationRef {
  // endDate ya paso: alquiler atrasado o no-show sin marcar (sigue bloqueando el vehiculo).
  overdue: boolean;
}

// GET /vehicles/:id. activeReservations solo para el personal (#137).
export interface VehicleDetail {
  id: string;
  companyId: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
  status: VehicleStatus;
  vehicleDocuments: VehicleDocument[];
  maintenanceRecords: MaintenanceRecord[];
  activeReservations?: VehicleActiveReservation[];
}

export interface RegisterVehicleRequest {
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: string;
  vin: string;
}

export interface UploadVehicleDocumentRequest {
  documentType: VehicleDocumentType;
  fileId: string;
  expiryDate: string;
}

export interface ScheduleMaintenanceRequest {
  type: MaintenanceType;
  scheduledStart: string;
  scheduledEnd: string;
  responsibleUserId?: string;
}

export interface CompleteMaintenanceRequest {
  fitForService: boolean;
}

export type DamageSeverityLevel = 'Minor' | 'Severe';

export interface ReportVehicleDamageRequest {
  severity: DamageSeverityLevel;
  reason?: string;
}

export interface MarkOutOfServiceRequest {
  reason?: string;
}

// add-rate-request.dto.ts (RATE_UNITS).
export type RateUnit = 'Day' | 'Week';

export interface VehicleRate {
  id: string;
  amountMinorUnits: number;
  currency: string;
  unit: RateUnit;
  validFrom: string;
  validTo?: string;
}

// GET /vehicle-categories devuelve solo { id, name }; el detalle trae las tarifas.
export interface VehicleCategoryDetail {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  rates: VehicleRate[];
}

export interface CreateVehicleCategoryRequest {
  name: string;
  description?: string;
}

export interface AddRateRequest {
  amountMinorUnits: number;
  currency: string;
  unit: RateUnit;
  validFrom: string;
  validTo?: string;
}
