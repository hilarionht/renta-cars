import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRES_PRODUCT_MODULE_KEY, RequestContext } from '@platform/persistence-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';

import { ApiException } from '../errors/api-exception';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS7, cuarto guard de la cadena (corre despues de
// CompanyStatusGuard). Para rutas sin @RequiresProductModule() (toda ruta de Fase 0 hoy),
// pasa siempre - el mecanismo es opt-in, no opt-out (docs/02-ARQUITECTURA.md SS4.2). Rutas
// @Public() (RegisterCompany, login, refresh) nunca tienen RequestContext poblado en este
// punto - las deja pasar, mismo criterio que TenantContextGuard/CompanyStatusGuard.
@Injectable()
export class TenantModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContext,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookup: SettingsLookupPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRES_PRODUCT_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredModule) {
      return true;
    }

    const requestContext = this.requestContext.tryGet();
    if (!requestContext) {
      return true;
    }

    const enabledModules = await this.settingsLookup.getEnabledProductModules(
      requestContext.companyId,
    );
    if (!enabledModules || !enabledModules.includes(requiredModule)) {
      throw new ApiException(
        403,
        'PRODUCT_MODULE_NOT_ENABLED',
        `El modulo "${requiredModule}" no esta habilitado para esta company.`,
      );
    }

    return true;
  }
}
