import { Module } from '@nestjs/common';

import {
  AssignRoleHandler,
  ChangePasswordHandler,
  CreateUserHandler,
  DisableUserHandler,
  PASSWORD_HASHER,
  ReactivateUserHandler,
  RevokeRoleHandler,
  USER_LOOKUP_PORT,
  USER_REPOSITORY,
} from '@platform/users/application';
import { RolesPermissionsModule } from '@platform/roles-permissions/infrastructure';

import { Argon2PasswordHasher } from './providers/argon2-password-hasher.provider';
import { PrismaUserLookupAdapter } from './persistence/prisma/prisma-user-lookup.adapter';
import { PrismaUserRepository } from './persistence/prisma/prisma-user.repository';
import { UsersController } from './http/users.controller';
import { GetUserHandler } from './queries/get-user.handler';

// Importa RolesPermissionsModule (no solo el puerto) - necesita que ROLE_LOOKUP_PORT este
// bindeado en el arbol de DI (docs/technical/03-BACKEND-ARCHITECTURE.md SS1: orden de
// import Identity -> Organization ya refleja esta dependencia real). COMPANY_EXISTS_PORT NO
// se bindea aca - libs/ no puede importar el adapter no-op de apps/api (tooling/eslint/
// boundaries.mjs); se bindea global en apps/api/src/app/persistence/prisma.module.ts, ya
// @Global(), visible en todo el arbol de DI sin que cada modulo lo repita.
@Module({
  imports: [RolesPermissionsModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: USER_LOOKUP_PORT, useClass: PrismaUserLookupAdapter },
    CreateUserHandler,
    DisableUserHandler,
    ReactivateUserHandler,
    ChangePasswordHandler,
    AssignRoleHandler,
    RevokeRoleHandler,
    GetUserHandler,
  ],
  // PASSWORD_HASHER se exporta ademas de USER_LOOKUP_PORT - LoginHandler (platform-identity)
  // lo necesita para verificar la contraseña presentada contra el hash guardado, usando el
  // mismo hasher que CreateUser/ChangePassword (nunca dos implementaciones de argon2id).
  exports: [USER_LOOKUP_PORT, PASSWORD_HASHER],
})
export class UsersModule {}
