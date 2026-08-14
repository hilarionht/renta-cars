// Superficie publica de "platform-users-application".
// Exporta explicitamente cada simbolo - prohibido `export *`, docs/technical/
// 09-CODING-STANDARDS.md SS2.
export { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
export { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port';
export {
  USER_LOOKUP_PORT,
  type UserLookupPort,
  type UserLookupResult,
} from './ports/user-lookup.port';

export type { CreateUserCommand } from './commands/create-user/create-user.command';
export { CreateUserHandler } from './commands/create-user/create-user.handler';
export type { DisableUserCommand } from './commands/disable-user/disable-user.command';
export { DisableUserHandler } from './commands/disable-user/disable-user.handler';
export type { ReactivateUserCommand } from './commands/reactivate-user/reactivate-user.command';
export { ReactivateUserHandler } from './commands/reactivate-user/reactivate-user.handler';
export type { ChangePasswordCommand } from './commands/change-password/change-password.command';
export { ChangePasswordHandler } from './commands/change-password/change-password.handler';
export type { AssignRoleCommand } from './commands/assign-role/assign-role.command';
export { AssignRoleHandler } from './commands/assign-role/assign-role.handler';
export type { RevokeRoleCommand } from './commands/revoke-role/revoke-role.command';
export { RevokeRoleHandler } from './commands/revoke-role/revoke-role.handler';

export type { GetUserQuery, UserSummary } from './queries/get-user/get-user.query';
