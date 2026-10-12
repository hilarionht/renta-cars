// Superficie publica de "platform-roles-permissions-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { ROLE_REPOSITORY, type RoleRepository } from './ports/role.repository';
export { ROLE_LOOKUP_PORT, type RoleLookupPort } from './ports/role-lookup.port';
export type { CreateRoleCommand } from './commands/create-role/create-role.command';
export { CreateRoleHandler } from './commands/create-role/create-role.handler';
export type { EditRolePermissionsCommand } from './commands/edit-role-permissions/edit-role-permissions.command';
export { EditRolePermissionsHandler } from './commands/edit-role-permissions/edit-role-permissions.handler';
export type { DeactivateRoleCommand } from './commands/deactivate-role/deactivate-role.command';
export { DeactivateRoleHandler } from './commands/deactivate-role/deactivate-role.handler';
export type { ListRolesQuery, RoleSummary } from './queries/list-roles/list-roles.query';
export type { PermissionSummary } from './queries/list-permissions/list-permissions.query';
