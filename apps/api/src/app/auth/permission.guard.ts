import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_KEY } from '@platform/persistence-kernel';
import { ROLE_LOOKUP_PORT, type RoleLookupPort } from '@platform/roles-permissions/application';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// docs/technical/07-SECURITY.md SS2: primer nivel de RBAC (@RequirePermission('reservations:
// create')). roles[] -> permissions[] se resuelve aca, no en el JWT (docs/09-SEGURIDAD.md
// SS1) - ROLE_LOOKUP_PORT.getPermissionsForRoles() esta respaldado por un cache en memoria
// (CachedRoleLookupAdapter, platform-roles-permissions-infrastructure), asi que esto no
// toca la base de datos de negocio en el camino caliente salvo el primer miss por role
// (Fase 4 item 2, docs/persistence/10-DECISIONES.md). El early-return de abajo (sin
// @RequirePermission() en la ruta) nunca invoca el puerto - ninguna ruta paga el costo de
// resolucion si no lo necesita.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ROLE_LOOKUP_PORT) private readonly roleLookupPort: RoleLookupPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const roleIds = request.user?.roles ?? [];
    const permissions = await this.roleLookupPort.getPermissionsForRoles(
      roleIds,
      request.user?.companyId,
    );

    if (!permissions.includes(requiredPermission)) {
      throw new ApiException(403, 'FORBIDDEN', `Falta el permiso "${requiredPermission}"`);
    }

    return true;
  }
}
