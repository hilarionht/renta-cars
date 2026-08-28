import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  DuplicateActiveVehicleDocumentError,
  DuplicateVehicleLicensePlateError,
  DuplicateVehicleVinError,
  InvalidDateRangeError,
  MaintenanceRecordInvalidStateTransitionError,
  MaintenanceRecordNotFoundError,
  RateNotFoundError,
  RateOverlapError,
  VehicleBranchNotFoundError,
  VehicleCategoryNotFoundError,
  VehicleDocumentExpiredError,
  VehicleDocumentNotFoundError,
  VehicleDocumentationIncompleteError,
  VehicleInvalidStateTransitionError,
  VehicleNotFoundError,
} from '@rental/vehicles/domain';

export const VEHICLES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    VehicleDocumentExpiredError,
    { status: 409, code: 'VEHICLE_DOCUMENT_EXPIRED', title: 'El documento esta vencido' },
  ],
  [
    VehicleDocumentationIncompleteError,
    {
      status: 422,
      code: 'VEHICLE_DOCUMENTATION_INCOMPLETE',
      title: 'El vehicle no tiene documentacion verificada',
    },
  ],
  [
    VehicleInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    MaintenanceRecordInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    RateOverlapError,
    {
      status: 409,
      code: 'RATE_OVERLAP',
      title: 'La vigencia de la rate se solapa con otra existente',
    },
  ],
  [
    DuplicateActiveVehicleDocumentError,
    {
      status: 409,
      code: 'DUPLICATE_ACTIVE_VEHICLE_DOCUMENT',
      title: 'Ya existe un documento activo de ese tipo para este vehicle',
    },
  ],
  [
    DuplicateVehicleLicensePlateError,
    { status: 409, code: 'DUPLICATE_VEHICLE_LICENSE_PLATE', title: 'Placa ya registrada' },
  ],
  [
    DuplicateVehicleVinError,
    { status: 409, code: 'DUPLICATE_VEHICLE_VIN', title: 'VIN ya registrado' },
  ],
  [
    VehicleBranchNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Branch no encontrada' },
  ],
  [
    VehicleNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Vehicle no encontrado' },
  ],
  [
    VehicleCategoryNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Vehicle category no encontrada' },
  ],
  [
    VehicleDocumentNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Vehicle document no encontrado' },
  ],
  [
    MaintenanceRecordNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Maintenance record no encontrado' },
  ],
  [RateNotFoundError, { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Rate no encontrada' }],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
  [
    InvalidDateRangeError,
    {
      status: 400,
      code: 'VEHICLE_SEARCH_INVALID_RANGE',
      title: 'El rango de fechas de busqueda es invalido',
    },
  ],
];
