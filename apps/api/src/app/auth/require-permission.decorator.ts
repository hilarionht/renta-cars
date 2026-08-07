import { SetMetadata } from '@nestjs/common';

// docs/technical/07-SECURITY.md SS2: primer nivel de RBAC, resuelto sin tocar la base de
// datos de negocio (los roles[] ya viajan en el access_token).
export const REQUIRE_PERMISSION_KEY = 'requiredPermission';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequirePermission = (permission: string): MethodDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
