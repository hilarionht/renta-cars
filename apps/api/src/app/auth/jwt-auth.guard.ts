import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from 'jsonwebtoken';

import { IS_PUBLIC_KEY } from '@platform/persistence-kernel';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS7: valida firma/expiracion/estructura
// minima. docs/contracts/07-ERROR-CATALOG.md SS4 distingue TOKEN_EXPIRED (unica senal que
// dispara refresh automatico en el cliente, docs/08-API-CONTRACTS.md SS9) de TOKEN_INVALID
// - passport-jwt/jsonwebtoken exponen esa distincion via `info`, nunca visible con el
// AuthGuard('jwt') por defecto sin sobreescribir handleRequest.
//
// canActivate() sobreescrito para respetar @Public() - antes de que este guard fuera
// APP_GUARD global (esta tanda, Fase 0), @Public() no tenia ningun efecto real porque
// JwtAuthGuard nunca corria por defecto; ahora que corre en toda ruta, sin este chequeo
// login/refresh/logout/health quedarian inalcanzables (exigirian un token que, por diseño,
// no tienen como conseguir).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(err: unknown, user: TUser | false, info: unknown): TUser {
    if (info instanceof TokenExpiredError) {
      throw new ApiException(401, 'TOKEN_EXPIRED', 'El access token expiro');
    }

    // passport-jwt usa este mensaje exacto cuando no encuentra ningun token en la request
    // (docs/contracts/07-ERROR-CATALOG.md SS4: UNAUTHENTICATED != TOKEN_INVALID).
    if (info instanceof Error && info.message === 'No auth token') {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Falta la cabecera Authorization');
    }

    if (err || !user) {
      throw new ApiException(401, 'TOKEN_INVALID', 'Token invalido');
    }

    return user;
  }
}
