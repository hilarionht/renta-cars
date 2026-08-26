import { Module } from '@nestjs/common';

import {
  LoginHandler,
  MFA_LOGIN_CHALLENGE_REPOSITORY,
  REFRESH_TOKEN_HASHER,
  RefreshSessionHandler,
  RevokeSessionHandler,
  SESSION_REPOSITORY,
  TOKEN_SIGNER,
} from '@platform/identity/application';
import { UsersModule } from '@platform/users/infrastructure';

import { AuthController } from './http/auth.controller';
import { JwtTokenSigner } from './providers/jwt-token-signer.provider';
import { PrismaMfaLoginChallengeRepository } from './persistence/prisma/prisma-mfa-login-challenge.repository';
import { PrismaSessionRepository } from './persistence/prisma/prisma-session.repository';
import { Sha256RefreshTokenHasher } from './providers/refresh-token-hasher.provider';

// Importa UsersModule (no solo USER_LOOKUP_PORT) - Login/RefreshSession necesitan que ese
// puerto (y PASSWORD_HASHER) esten bindeados en el arbol de DI. Orden de import en
// AppModule: RolesPermissions -> Users -> Identity (docs/technical/03-BACKEND-
// ARCHITECTURE.md SS1), cada uno depende del anterior.
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: MFA_LOGIN_CHALLENGE_REPOSITORY, useClass: PrismaMfaLoginChallengeRepository },
    { provide: TOKEN_SIGNER, useClass: JwtTokenSigner },
    { provide: REFRESH_TOKEN_HASHER, useClass: Sha256RefreshTokenHasher },
    LoginHandler,
    RefreshSessionHandler,
    RevokeSessionHandler,
  ],
  // TOKEN_SIGNER exportado para Fase 5 cliente-autogestion (docs/persistence/
  // 10-DECISIONES.md #109) - RefreshCustomerSessionHandler (rental/customers/application)
  // firma el access_token de CustomerSession con el mismo TOKEN_SIGNER que emite los de
  // staff (misma clave RS256, campo actorType adicional distingue el origen). Primer
  // consumidor cross-modulo de IdentityModule fuera de si mismo.
  exports: [TOKEN_SIGNER],
})
export class IdentityModule {}
