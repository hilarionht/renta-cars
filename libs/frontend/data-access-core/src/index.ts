// @frontend/data-access-core - capa de datos agnostica de plataforma, compartida por mobile y
// web (docs/persistence/10-DECISIONES.md #134). Sin dependencias de Expo ni de Next.
export { ApiError, AuthenticationExpiredError } from './api-errors';
export {
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type PageMeta,
  type RequestOptions,
} from './api-client';
export { decodeAccessToken, type AccessTokenClaims } from './decode-access-token';
export {
  NonexistentLocalTimeError,
  formatInTimeZone,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
  type ZonedLocalDateTime,
} from './time-zone';
