// docs/09-SEGURIDAD.md SS1: access_token JWT RS256, contiene sub/companyId/branchId?/
// roles/iat/exp - sin permisos granulares (se resuelven fuera del token). La implementacion
// real (infrastructure/providers) usa jsonwebtoken (ya dependencia) + jwt.config.ts
// (privateKey/activeKid) - antes de esta tanda ese config solo se usaba para VERIFICAR
// (apps/api/src/app/auth/jwt.strategy.ts), nunca para firmar.
export const TOKEN_SIGNER = Symbol('TokenSigner');

export interface AccessTokenClaims {
  sub: string;
  companyId: string;
  branchId?: string;
  roles: string[];
}

export interface TokenSigner {
  signAccessToken(claims: AccessTokenClaims): string;
}
