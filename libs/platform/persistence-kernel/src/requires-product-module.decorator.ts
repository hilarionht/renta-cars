import { SetMetadata } from '@nestjs/common';

// docs/02-ARQUITECTURA.md SS4.2 / docs/technical/03-BACKEND-ARCHITECTURE.md SS7:
// TenantModuleEnabledGuard (apps/api) lee esta metadata para exigir que
// CompanySettings.EnabledProductModules incluya el modulo pedido. Vive aca (no en
// apps/api/src/app/context, donde vive el guard que la lee) por el mismo motivo que
// Public()/IS_PUBLIC_KEY: los controllers que lo van a aplicar en el futuro (Fase 1,
// libs/products/rental/*) son libs/ - libs/ no puede importar apps/api (tooling/eslint/
// boundaries.mjs). Parametro string, no un enum cerrado - EnabledProductModules es un
// conjunto ABIERTO por diseño (docs/contracts/08-VERSIONING.md SS5), 'Rental' es el unico
// valor real hoy.
export const REQUIRES_PRODUCT_MODULE_KEY = 'requiresProductModule';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequiresProductModule = (moduleName: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_PRODUCT_MODULE_KEY, moduleName);
