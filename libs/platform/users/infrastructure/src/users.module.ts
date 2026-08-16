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
import { CompaniesModule } from '@platform/companies/infrastructure';

import { Argon2PasswordHasher } from './providers/argon2-password-hasher.provider';
import { PrismaUserLookupAdapter } from './persistence/prisma/prisma-user-lookup.adapter';
import { PrismaUserRepository } from './persistence/prisma/prisma-user.repository';
import { UsersController } from './http/users.controller';
import { GetUserHandler } from './queries/get-user.handler';

// Importa RolesPermissionsModule/CompaniesModule (no solo sus puertos) - necesita que
// ROLE_LOOKUP_PORT/COMPANY_EXISTS_PORT esten bindeados en el arbol de DI (ninguno de los dos
// modulos es @Global()). Companies ahora existe de verdad (antes de esta tanda,
// COMPANY_EXISTS_PORT se bindeaba global en apps/api via NoopCompanyExistsAdapter - ya
// eliminado, ver plan de implementacion) - el import invierte el orden literal del roadmap
// (Companies #3 antes que Users #5) pero coincide con la dependencia real de dominio (un
// User pertenece a una Company).
@Module({
  imports: [RolesPermissionsModule, CompaniesModule],
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
