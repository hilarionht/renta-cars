import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - exige
// request.user.actorType === 'Customer', aplicado solo a las rutas de autogestion
// (customer-auth.controller.ts, me-reservations.controller.ts). Un chequeo explicito es mas
// barato que confiar en la no-colision de UUIDs entre identity.users/rental.customers como
// mecanismo de seguridad "seguro por accidente" - sin este guard, un JWT de staff pasaria
// TenantContextGuard/CompanyStatusGuard sin ningun cambio de codigo (misma forma de claims)
// y fallaria el chequeo de ownership solo por coincidencia de UUID, un 404 confuso en vez
// de un 403 claro.
@Injectable()
export class CustomerActorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (request.user?.actorType !== 'Customer') {
      throw new ApiException(403, 'FORBIDDEN', 'Esta ruta es exclusiva de clientes autenticados.');
    }

    return true;
  }
}
