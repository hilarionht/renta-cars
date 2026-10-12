import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_STAFF_ACTOR_KEY } from '@platform/persistence-kernel';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - registrado global via APP_GUARD
// (app.module.ts), espejo exacto pero inverso de CustomerActorGuard: en vez de exigir
// actorType === 'Customer', exige que actorType NO sea 'Customer' (staff tokens no llevan
// esta clave en absoluto - JSON.stringify descarta undefined, ver jwt-token-signer.provider.ts).
// Opt-in via @RequireStaffActor() (persistence-kernel, ver ese archivo), early-return sin
// costo en cualquier ruta que no la lleve.
@Injectable()
export class StaffActorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresStaffActor = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_STAFF_ACTOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresStaffActor) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (request.user?.actorType === 'Customer') {
      throw new ApiException(403, 'FORBIDDEN', 'Esta ruta es exclusiva de personal (staff).');
    }

    return true;
  }
}
