// Contenido minimo del access_token - docs/09-SEGURIDAD.md SS1. Sin permisos granulares
// completos a proposito (evita tokens infladas, evita que un cambio de permisos tarde
// hasta la expiracion del token en aplicarse) - `permissions` se resuelve fuera del token,
// en PermissionGuard, via CachedRoleLookupAdapter (roles[] -> permissions[], Fase 4 item 2)
// - nunca viaja en el JWT mismo, por eso no es un campo de esta interfaz.
export interface JwtPayload {
  sub: string;
  companyId: string;
  branchId?: string;
  roles: string[];
  // Ver AccessTokenClaims.actorType (platform/identity/application) - mismo campo, aditivo.
  actorType?: 'Customer';
}
