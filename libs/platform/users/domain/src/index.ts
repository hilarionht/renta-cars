// Superficie publica de "platform-users-domain".
// Exporta explicitamente cada simbolo - prohibido `export *`, docs/technical/
// 09-CODING-STANDARDS.md SS2.
export { User, type UserId, type UserProps } from './entities/user';
export {
  PasswordResetChallenge,
  type PasswordResetChallengeId,
  type PasswordResetChallengeProps,
  type PasswordResetOutcome,
} from './entities/password-reset-challenge';
export { PersonName } from './value-objects/person-name';
export { PasswordHash } from './value-objects/password-hash';
export { EncryptedMfaSecret } from './value-objects/encrypted-mfa-secret';
export { PasswordResetTokenHash } from './value-objects/password-reset-token-hash';
export type { UserStatus } from './value-objects/user-status';
export { UserDisabledError } from './errors/user-disabled.error';
export { UserNotFoundError } from './errors/user-not-found.error';
export { DuplicateEmailError } from './errors/duplicate-email.error';
export { CompanyNotFoundError } from './errors/company-not-found.error';
export { InvalidRoleAssignmentError } from './errors/invalid-role-assignment.error';
export { InvalidMfaCodeError } from './errors/invalid-mfa-code.error';
export { PasswordResetTokenInvalidError } from './errors/password-reset-token-invalid.error';
export type { UserCreatedEvent } from './events/user-created.event';
export type { UserDisabledEvent } from './events/user-disabled.event';
export type { UserPasswordChangedEvent } from './events/user-password-changed.event';
export type { UserMfaEnabledEvent } from './events/user-mfa-enabled.event';
export type { UserMfaDisabledEvent } from './events/user-mfa-disabled.event';
export type { PasswordResetTokenReplayedEvent } from './events/password-reset-token-replayed.event';
