// Superficie publica de "platform-roles-permissions-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { RolesPermissionsModule } from './roles-permissions.module';
export { ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES } from './errors/roles-permissions-domain-error.registry';
