import { Module } from '@nestjs/common';

import {
  LoginHandler,
  REFRESH_TOKEN_HASHER,
  RefreshSessionHandler,
  RevokeSessionHandler,
  SESSION_REPOSITORY,
  TOKEN_SIGNER,
} from '@platform/identity/application';
import { UsersModule } from '@platform/users/infrastructure';

import { AuthController } from './http/auth.controller';
import { JwtTokenSigner } from './providers/jwt-token-signer.provider';
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
    { provide: TOKEN_SIGNER, useClass: JwtTokenSigner },
    { provide: REFRESH_TOKEN_HASHER, useClass: Sha256RefreshTokenHasher },
    LoginHandler,
    RefreshSessionHandler,
    RevokeSessionHandler,
  ],
})
export class IdentityModule {}
