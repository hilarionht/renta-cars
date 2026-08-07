// Contenido minimo del access_token - docs/09-SEGURIDAD.md SS1. Sin permisos granulares
// completos a proposito (evita tokens infladas); `permissions` se resuelve fuera del
// token y hoy no existe ningun mecanismo real que lo pueble (Fase 0/Identity,
// docs/technical/03-BACKEND-ARCHITECTURE.md SS7).
export interface JwtPayload {
  sub: string;
  companyId: string;
  branchId?: string;
  roles: string[];
  permissions?: string[];
}
