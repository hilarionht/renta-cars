// Superficie publica de "rental-vehicles-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Vehicle, type VehicleId, type VehicleProps } from './entities/vehicle';
export {
  VehicleDocument,
  type VehicleDocumentId,
  type VehicleDocumentProps,
} from './entities/vehicle-document';
export {
  MaintenanceRecord,
  type MaintenanceRecordId,
  type MaintenanceRecordProps,
} from './entities/maintenance-record';
export {
  VehicleCategory,
  type VehicleCategoryId,
  type VehicleCategoryProps,
} from './entities/vehicle-category';
export { Rate, type RateId, type RateProps } from './entities/rate';
export { LicensePlate } from './value-objects/license-plate';
export { VIN } from './value-objects/vin';
export { CategoryName } from './value-objects/category-name';
export type { VehicleStatusValue } from './value-objects/vehicle-status';
export type { VehicleDocumentTypeValue } from './value-objects/vehicle-document-type';
export type { VehicleDocumentStatusValue } from './value-objects/vehicle-document-status';
export type { MaintenanceTypeValue } from './value-objects/maintenance-type';
export type { MaintenanceStatusValue } from './value-objects/maintenance-status';
export type { RateUnitValue } from './value-objects/rate-unit';
export type { DamageSeverityValue } from './value-objects/damage-severity';
export { VehicleNotFoundError } from './errors/vehicle-not-found.error';
export { VehicleCategoryNotFoundError } from './errors/vehicle-category-not-found.error';
export { VehicleDocumentNotFoundError } from './errors/vehicle-document-not-found.error';
export { MaintenanceRecordNotFoundError } from './errors/maintenance-record-not-found.error';
export { RateNotFoundError } from './errors/rate-not-found.error';
export { VehicleBranchNotFoundError } from './errors/vehicle-branch-not-found.error';
export { VehicleDocumentExpiredError } from './errors/vehicle-document-expired.error';
export { VehicleDocumentationIncompleteError } from './errors/vehicle-documentation-incomplete.error';
export { VehicleInvalidStateTransitionError } from './errors/vehicle-invalid-state-transition.error';
export { MaintenanceRecordInvalidStateTransitionError } from './errors/maintenance-record-invalid-state-transition.error';
export { RateOverlapError } from './errors/rate-overlap.error';
export { DuplicateActiveVehicleDocumentError } from './errors/duplicate-active-vehicle-document.error';
export { DuplicateVehicleLicensePlateError } from './errors/duplicate-vehicle-license-plate.error';
export { DuplicateVehicleVinError } from './errors/duplicate-vehicle-vin.error';
export type { VehicleRegisteredEvent } from './events/vehicle-registered.event';
export type { VehicleDocumentationLoadedEvent } from './events/vehicle-documentation-loaded.event';
export type { VehicleEnabledEvent } from './events/vehicle-enabled.event';
export type { VehicleStatusChangedEvent } from './events/vehicle-status-changed.event';
export type { MaintenanceScheduledEvent } from './events/maintenance-scheduled.event';
export type { MaintenanceCompletedEvent } from './events/maintenance-completed.event';
export type { VehicleCategoryCreatedEvent } from './events/vehicle-category-created.event';
export type { RateChangedEvent } from './events/rate-changed.event';
