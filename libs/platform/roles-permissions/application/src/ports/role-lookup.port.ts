// Puerto publico consumido por otros modulos (hoy: users, para validar un roleId al
// asignarlo) - superficie minima, nunca expone el RoleRepository completo cross-modulo
// (docs/05-CONVENCIONES-BACKEND.md SS3: application/ solo importa el index.ts publico de
// otro modulo).
export const ROLE_LOOKUP_PORT = Symbol('RoleLookupPort');

export interface RoleLookupPort {
  existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean>;
  // Agregado para Fase 4 item 2 (RBAC completo) - PermissionGuard resuelve roles[] (del JWT)
  // -> permissions[] (union, sin duplicados) sin tocar la base de datos de negocio en el
  // camino caliente (docs/09-SEGURIDAD.md SS1) via una capa de cache en memoria
  // (CachedRoleLookupAdapter, platform-roles-permissions-infrastructure). companyId
  // opcional explicito - mismo mecanismo que el resto del repo (PermissionGuard corre
  // dentro de una request autenticada, pero se pasa explicito para no depender de
  // RequestContext ambiente). Roles con status != 'Active' contribuyen 0 permisos - un rol
  // desactivado (Role.deactivate()) no borra su columna permissions, solo cambia status.
  getPermissionsForRoles(roleIds: string[], companyId?: string): Promise<string[]>;
}
