// Superficie publica de "platform-identity-domain".
// Exporta explicitamente cada simbolo - prohibido `export *`, docs/technical/
// 09-CODING-STANDARDS.md SS2.
export { Session, type SessionId, type SessionProps } from './entities/session';
export { RefreshTokenHash } from './value-objects/refresh-token-hash';
export type { SessionStatus } from './value-objects/session-status';
export { DeviceContext } from './value-objects/device-context';
export {
  SessionSecurityService,
  type RotateOutcome,
  type RotateParams,
} from './services/session-security.service';
export { RefreshTokenReusedError } from './errors/refresh-token-reused.error';
export { InvalidCredentialsError } from './errors/invalid-credentials.error';
export { UserDisabledError } from './errors/user-disabled.error';
export { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
export type { SessionCreatedEvent } from './events/session-created.event';
export type { SessionRevokedEvent } from './events/session-revoked.event';
export type { SessionTheftDetectedEvent } from './events/session-theft-detected.event';
export type { LoginFailedEvent } from './events/login-failed.event';
