import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

// docs/technical/07-SECURITY.md SS2: mecanismo del primer nivel de RBAC
// (@RequirePermission('reservations:create')) - implementado como paso 9 del bootstrap
// pide explicitamente, "sin permisos de negocio reales todavia". Ningun modulo resuelve
// hoy roles[] -> permissions[] (llega con el modulo Identity de Fase 0,
// docs/01-ROADMAP.md), asi que un endpoint que declare @RequirePermission() sin que
// Identity exista siempre rechaza (falla cerrado, no abierto) - intencional, no un bug:
// nada debe poder marcarse "autorizado" sin un catalogo de permisos real detras.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const hasPermission = request.user?.permissions?.includes(requiredPermission) ?? false;

    if (!hasPermission) {
      throw new ApiException(403, 'FORBIDDEN', `Falta el permiso "${requiredPermission}"`);
    }

    return true;
  }
}
