import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from 'jsonwebtoken';

import { ApiException } from '../errors/api-exception';
import type { JwtPayload } from './jwt-payload.interface';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS7: valida firma/expiracion/estructura
// minima. docs/contracts/07-ERROR-CATALOG.md SS4 distingue TOKEN_EXPIRED (unica senal que
// dispara refresh automatico en el cliente, docs/08-API-CONTRACTS.md SS9) de TOKEN_INVALID
// - passport-jwt/jsonwebtoken exponen esa distincion via `info`, nunca visible con el
// AuthGuard('jwt') por defecto sin sobreescribir handleRequest.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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
