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
export type { VehicleCategoryRef, VehicleSummary } from './vehicle.types';
