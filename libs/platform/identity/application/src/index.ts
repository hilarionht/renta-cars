// Superficie publica de "platform-identity-application".
// Exporta explicitamente cada simbolo - prohibido `export *`, docs/technical/
// 09-CODING-STANDARDS.md SS2.
export { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
export {
  MFA_LOGIN_CHALLENGE_REPOSITORY,
  type MfaLoginChallengeRepository,
} from './ports/mfa-login-challenge.repository';
export { TOKEN_SIGNER, type TokenSigner, type AccessTokenClaims } from './ports/token-signer.port';
export { REFRESH_TOKEN_HASHER, type RefreshTokenHasher } from './ports/refresh-token-hasher.port';
export { SessionIssuer, type IssuedSession } from './services/session-issuer';

export type { LoginCommand, LoginResult } from './commands/login/login.command';
export { LoginHandler } from './commands/login/login.handler';
export type {
  RefreshSessionCommand,
  RefreshSessionResult,
} from './commands/refresh-session/refresh-session.command';
export { RefreshSessionHandler } from './commands/refresh-session/refresh-session.handler';
export type { RevokeSessionCommand } from './commands/revoke-session/revoke-session.command';
export { RevokeSessionHandler } from './commands/revoke-session/revoke-session.handler';
export type {
  VerifyMfaLoginCommand,
  VerifyMfaLoginResult,
} from './commands/verify-mfa-login/verify-mfa-login.command';
export { VerifyMfaLoginHandler } from './commands/verify-mfa-login/verify-mfa-login.handler';
