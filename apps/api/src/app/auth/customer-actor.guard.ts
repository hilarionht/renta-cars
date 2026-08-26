import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_CUSTOMER_ACTOR_KEY } from '@platform/persistence-kernel';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - registrado global
// via APP_GUARD (app.module.ts), mismo patron que PermissionGuard: opt-in via
// @RequireCustomerActor() (persistence-kernel, ver ese archivo para por que la metadata vive
// ahi y no aca), early-return sin costo en cualquier ruta que no la lleve. Exige
// request.user.actorType === 'Customer' - un chequeo explicito es mas barato que confiar en
// la no-colision de UUIDs entre identity.users/rental.customers como mecanismo de seguridad
// "seguro por accidente". Sin este guard, un JWT de staff pasaria TenantContextGuard/
// CompanyStatusGuard sin ningun cambio de codigo (misma forma de claims) y fallaria el
// chequeo de ownership solo por coincidencia de UUID, un 404 confuso en vez de un 403 claro.
@Injectable()
export class CustomerActorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresCustomerActor = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_CUSTOMER_ACTOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresCustomerActor) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (request.user?.actorType !== 'Customer') {
      throw new ApiException(403, 'FORBIDDEN', 'Esta ruta es exclusiva de clientes autenticados.');
    }

    return true;
  }
}
