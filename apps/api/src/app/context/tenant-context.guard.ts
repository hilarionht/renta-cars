import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import type { JwtPayload } from '../auth/jwt-payload.interface';
import { RequestContext } from './request-context';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS7, segundo guard de la cadena (corre despues
// de JwtAuthGuard). Construye el RequestContext a partir del payload YA validado por el JWT
// - nunca confia en companyId/branchId provistos por el cliente en body/query. Endpoints
// @Public() (login, refresh) no tienen JwtAuthGuard corriendo antes, por lo que
// request.user no existe - este guard los deja pasar sin poblar contexto (no hay tenant
// todavia en esos endpoints).
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly requestContext: RequestContext) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const payload = request.user;

    if (payload) {
      this.requestContext.set({
        companyId: payload.companyId,
        branchId: payload.branchId,
        userId: payload.sub,
        roles: payload.roles,
      });
    }

    return true;
  }
}
