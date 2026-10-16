// Exporta explicitamente, nunca `export *` (docs/technical/09-CODING-STANDARDS.md).
// docs/technical/02-PROYECTOS.md SS4: tipos/DTOs generados desde el contrato OpenAPI de
// docs/08-API-CONTRACTS.md - sin pipeline de codegen real todavia (sin Swagger en el repo,
// confirmado), asi que estos primeros tipos (Fase 5, operador de sucursal) son escritos a
// mano, verificados 1:1 contra los DTOs/schema reales del backend citados en cada archivo -
// un stand-in explicito, no la intencion original del stub. Un futuro pase de codegen real
// los reemplaza, no los fusiona a ciegas.
export type { LoginRequest, AuthResponse } from './auth.types';
export type { RequestCustomerOtpRequest, VerifyCustomerOtpRequest } from './customer-auth.types';
export type {
  ReservationStatusForOperator,
  ReservationSummary,
  CheckOutReservationRequest,
  DamageSeverity,
  CheckInDamage,
  CheckInReservationRequest,
  CreateMyReservationRequest,
  CreateMyReservationResponse,
} from './reservation.types';
export type {
  RequestUploadUrlRequest,
  RequestUploadUrlResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
} from './file.types';
export type { VehicleCategoryRef, VehicleReservationRef, VehicleSummary } from './vehicle.types';
export type {
  CurrentUser,
  MfaRequiredResponse,
  WebAuthResponse,
  WebLoginResponse,
} from './staff-session.types';
export type {
  ApproveExtensionRequest,
  BranchSummary,
  CreateReservationRequest,
  CustomerListItem,
  InvoiceCharge,
  InvoiceSummary,
  PriceAdjustmentKind,
  RequestExtensionRequest,
  RescheduleReservationRequest,
  ReservationCustomerRef,
  ReservationDamageReport,
  ReservationDetail,
  ReservationInspection,
  ReservationListItem,
  ReservationPriceAdjustment,
  ReservationStatus,
  ReservationVehicleRef,
  SwapVehicleRequest,
} from './staff-reservation.types';
export type {
  AddRateRequest,
  CompleteMaintenanceRequest,
  CreateVehicleCategoryRequest,
  DamageSeverityLevel,
  MaintenanceRecord,
  MaintenanceType,
  MarkOutOfServiceRequest,
  RateUnit,
  RegisterVehicleRequest,
  ReportVehicleDamageRequest,
  ScheduleMaintenanceRequest,
  UploadVehicleDocumentRequest,
  VehicleActiveReservation,
  VehicleCategoryDetail,
  VehicleDetail,
  VehicleDocument,
  VehicleDocumentType,
  VehicleRate,
  VehicleStatus,
} from './fleet.types';
export type {
  AdditionalDriver,
  AdditionalDriverStatus,
  BlockCustomerRequest,
  CustomerBlockStatus,
  CustomerDetail,
  CustomerStatus,
  CustomerType,
  DocumentStatus,
  IdentityDocument,
  IdentityDocumentType,
  RegisterAdditionalDriverRequest,
  RegisterCustomerRequest,
  UpdateCustomerRequest,
  UploadIdentityDocumentRequest,
} from './customer.types';
export type {
  AuditLogEntry,
  BranchAddress,
  CancellationPolicyTier,
  ChangePasswordRequest,
  Company,
  CompanySettings,
  CreateBranchRequest,
  CreateRoleRequest,
  CreateUserRequest,
  DaySchedule,
  DisableUserRequest,
  EditRolePermissionsRequest,
  PermissionKey,
  Role,
  RoleAssignmentRequest,
  RoleScope,
  RoleStatus,
  SettingsPolicy,
  SettingsPolicyRequests,
  StaffUser,
  UpdateBranchRequest,
  UpdateCompanyRequest,
  UpdateUserRequest,
  UserStatus,
} from './admin.types';
