// Superficie publica de "platform-roles-permissions-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Role, type RoleId, type RoleProps } from './entities/role';
export { RoleName } from './value-objects/role-name';
export type { RoleScope } from './value-objects/role-scope';
export type { RoleStatus } from './value-objects/role-status';
export { Permission } from './value-objects/permission';
export { PERMISSION_CATALOG, type PermissionKey } from './value-objects/permission-catalog';
export { SystemRoleImmutableError } from './errors/system-role-immutable.error';
export { EmptyPermissionSetError } from './errors/empty-permission-set.error';
export { DuplicateRoleNameError } from './errors/duplicate-role-name.error';
export { RoleNotFoundError } from './errors/role-not-found.error';
export type { RoleCreatedEvent } from './events/role-created.event';
export type { RolePermissionsChangedEvent } from './events/role-permissions-changed.event';
export type { RoleDeactivatedEvent } from './events/role-deactivated.event';
