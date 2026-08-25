// Exporta explicitamente, nunca `export *` (docs/technical/09-CODING-STANDARDS.md).
// docs/06-CONVENCIONES-FRONTEND.md SS6: hooks de dominio (React Query) por Bounded
// Context (useReservations, useVehicleAvailability, auth/) - ninguna pantalla llama
// fetch/axios directamente, todo pasa por apiRequest()/los hooks de acá.
export { apiRequest, ApiError, AuthenticationExpiredError } from './auth/api-client';
export { AuthProvider, useAuth } from './auth/auth-context';
export { decodeAccessToken, type AccessTokenClaims } from './auth/decode-access-token';
