// Catalogo de permisos versionado en codigo, nunca una tabla (docs/persistence/
// 07-MIGRACIONES.md SS5.1) - agregar un permiso es un cambio de codigo revisado, no una
// fila que cualquiera pueda insertar en runtime. Alcance de esta tanda: solo los recursos
// de Identity & Access (docs/contracts/02-RESOURCE-CATALOG.md SS1) que esta misma tanda
// construye - un futuro modulo (p.ej. rental) agrega sus propias claves a esta misma
// constante cuando exista, nunca un catalogo paralelo.
export const PERMISSION_CATALOG = [
  'users:create',
  'users:edit',
  'users:disable',
  'users:reactivate',
  'users:change-password',
  'users:assign-role',
  'users:revoke-role',
  'roles:create',
  'roles:edit-permissions',
  'roles:deactivate',
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number];
