import { SetMetadata } from '@nestjs/common';

// docs/technical/07-SECURITY.md SS2: primer nivel de RBAC, resuelto sin tocar la base de
// datos de negocio en el camino caliente (los roles[] ya viajan en el access_token,
// PermissionGuard resuelve roles[] -> permissions[] via un cache en memoria, nunca
// permissions[] embebido en el JWT - docs/09-SEGURIDAD.md SS1). Vive aca (no en
// apps/api/src/app/auth, donde vive PermissionGuard que LEE esta metadata) porque los
// controllers que lo aplican son libs/ - libs/ no puede importar apps/api (tooling/eslint/
// boundaries.mjs) - mismo motivo exacto que Public()/IS_PUBLIC_KEY y
// RequiresProductModule()/REQUIRES_PRODUCT_MODULE_KEY, mismo archivo de origen. Estuvo
// atado a apps/api desde Fase 0 sin que ningun controller de libs/ pudiera aplicarlo nunca -
// bug estructural real, corregido en Fase 4 item 2 (RBAC completo).
export const REQUIRE_PERMISSION_KEY = 'requiredPermission';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequirePermission = (permission: string): MethodDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
