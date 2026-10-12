import { SetMetadata } from '@nestjs/common';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). Vive aca (no en
// apps/api/src/app/auth, donde vive CustomerActorGuard que LEE esta metadata) porque el
// controller que lo aplica (me-reservations.controller.ts) es libs/ - libs/ no puede
// importar apps/api (tooling/eslint/boundaries.mjs) - mismo motivo exacto que
// RequirePermission()/REQUIRE_PERMISSION_KEY, mismo archivo de origen.
export const REQUIRE_CUSTOMER_ACTOR_KEY = 'requireCustomerActor';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequireCustomerActor = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_CUSTOMER_ACTOR_KEY, true);
