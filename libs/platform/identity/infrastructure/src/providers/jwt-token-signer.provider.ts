import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';

import type { AccessTokenClaims, TokenSigner } from '@platform/identity/application';

// jsonwebtoken (ya dependencia, no se agrega jose) - firma con la misma privateKey/activeKid
// que apps/api/src/app/auth/jwt.strategy.ts usa para VERIFICAR (jwt.config.ts). Antes de
// esta tanda nada firmaba de verdad - jwt.strategy.ts solo validaba tokens ya emitidos.
@Injectable()
export class JwtTokenSigner implements TokenSigner {
  constructor(private readonly configService: ConfigService) {}

  signAccessToken(claims: AccessTokenClaims): string {
    const jwtConfig = this.configService.getOrThrow<{
      privateKey: string;
      activeKid: string;
      accessTtlSeconds: number;
    }>('jwt');

    return sign(
      { companyId: claims.companyId, branchId: claims.branchId, roles: claims.roles },
      jwtConfig.privateKey,
      {
        algorithm: 'RS256',
        keyid: jwtConfig.activeKid,
        subject: claims.sub,
        expiresIn: jwtConfig.accessTtlSeconds,
      },
    );
  }
}
