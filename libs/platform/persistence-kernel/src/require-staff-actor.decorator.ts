import { SetMetadata } from '@nestjs/common';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111). Mismo motivo estructural que
// RequireCustomerActor() (mismo archivo de origen, ver ese archivo): vive aca porque el
// controller que lo aplica (user-mfa.controller.ts) es libs/ - libs/ no puede importar
// apps/api (tooling/eslint/boundaries.mjs). Espejo exacto pero inverso de
// RequireCustomerActor(): protege una ruta self-service de STAFF (users/me/mfa/*) de un
// access_token de Customer, que de otro modo pasaria JwtAuthGuard/TenantContextGuard/
// CompanyStatusGuard sin cambio de codigo (misma forma de claims) y llegaria a
// USER_LOOKUP_PORT.findById(customerId, companyId) - que devuelve null (un customerId no es
// un userId) y produce un error confuso en vez de un 403 limpio.
export const REQUIRE_STAFF_ACTOR_KEY = 'requireStaffActor';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequireStaffActor = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_STAFF_ACTOR_KEY, true);
