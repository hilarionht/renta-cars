// Superficie publica de "rental-vehicles-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { VEHICLE_REPOSITORY, type VehicleRepository } from './ports/vehicle.repository';
export {
  VEHICLE_CATEGORY_REPOSITORY,
  type VehicleCategoryRepository,
} from './ports/vehicle-category.repository';
export { VEHICLE_STATUS_PORT, type VehicleStatusPort } from './ports/vehicle-status.port';
export {
  VEHICLE_CATEGORY_LOOKUP_PORT,
  type VehicleCategoryLookupPort,
  type CurrentRate,
} from './ports/vehicle-category-lookup.port';

export { RegisterVehicleHandler } from './commands/register-vehicle/register-vehicle.handler';
export type { RegisterVehicleCommand } from './commands/register-vehicle/register-vehicle.command';
export { UploadVehicleDocumentHandler } from './commands/upload-vehicle-document/upload-vehicle-document.handler';
export type { UploadVehicleDocumentCommand } from './commands/upload-vehicle-document/upload-vehicle-document.command';
export { VerifyVehicleDocumentHandler } from './commands/verify-vehicle-document/verify-vehicle-document.handler';
export type { VerifyVehicleDocumentCommand } from './commands/verify-vehicle-document/verify-vehicle-document.command';
export { EnableVehicleHandler } from './commands/enable-vehicle/enable-vehicle.handler';
export type { EnableVehicleCommand } from './commands/enable-vehicle/enable-vehicle.command';
export { ScheduleMaintenanceHandler } from './commands/schedule-maintenance/schedule-maintenance.handler';
export type { ScheduleMaintenanceCommand } from './commands/schedule-maintenance/schedule-maintenance.command';
export { StartMaintenanceHandler } from './commands/start-maintenance/start-maintenance.handler';
export type { StartMaintenanceCommand } from './commands/start-maintenance/start-maintenance.command';
export { CompleteMaintenanceHandler } from './commands/complete-maintenance/complete-maintenance.handler';
export type { CompleteMaintenanceCommand } from './commands/complete-maintenance/complete-maintenance.command';
export { ReportDamageHandler } from './commands/report-damage/report-damage.handler';
export type { ReportDamageCommand } from './commands/report-damage/report-damage.command';
export { MarkVehicleOutOfServiceHandler } from './commands/mark-vehicle-out-of-service/mark-vehicle-out-of-service.handler';
export type { MarkVehicleOutOfServiceCommand } from './commands/mark-vehicle-out-of-service/mark-vehicle-out-of-service.command';
export { CreateVehicleCategoryHandler } from './commands/create-vehicle-category/create-vehicle-category.handler';
export type { CreateVehicleCategoryCommand } from './commands/create-vehicle-category/create-vehicle-category.command';
export { AddRateHandler } from './commands/add-rate/add-rate.handler';
export type { AddRateCommand } from './commands/add-rate/add-rate.command';

export type {
  GetVehicleQuery,
  VehicleDetail,
  VehicleDocumentSummary,
  MaintenanceRecordSummary,
  ListVehiclesQuery,
  VehicleSummary,
} from './queries/get-vehicle/get-vehicle.query';
export type {
  GetVehicleCategoryQuery,
  VehicleCategoryDetail,
  RateSummary,
  ListVehicleCategoriesQuery,
  VehicleCategorySummary,
} from './queries/get-vehicle-category/get-vehicle-category.query';
