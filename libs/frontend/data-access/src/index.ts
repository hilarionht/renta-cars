// Exporta explicitamente, nunca `export *` (docs/technical/09-CODING-STANDARDS.md).
// docs/06-CONVENCIONES-FRONTEND.md SS6: hooks de dominio (React Query) por Bounded
// Context (useReservations, useVehicleAvailability, auth/) - ninguna pantalla llama
// fetch/axios directamente, todo pasa por apiRequest()/los hooks de acá.
export { apiRequest, ApiError, AuthenticationExpiredError } from './auth/api-client';
export { AuthProvider, useAuth } from './auth/auth-context';
export { decodeAccessToken, type AccessTokenClaims } from './auth/decode-access-token';
export {
  useReservationsToCheckOut,
  useReservationsToCheckIn,
  useCheckOutReservation,
  useCheckInReservation,
} from './reservations/reservations-hooks';
export { useUploadPhoto } from './files/use-upload-photo';
export { customerApiRequest } from './customer-auth/customer-api-client';
export { CustomerAuthProvider, useCustomerAuth } from './customer-auth/customer-auth-context';
export { registerDevicePushToken } from './customer-auth/register-device-push-token';
export {
  useMyReservations,
  useMyReservation,
  useCreateMyReservation,
  useCancelMyReservation,
} from './customer-reservations/customer-reservations-hooks';
