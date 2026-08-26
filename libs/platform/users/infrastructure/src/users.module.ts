import { Module } from '@nestjs/common';

import {
  AssignRoleHandler,
  ChangePasswordHandler,
  CreateUserHandler,
  DisableUserHandler,
  MFA_SECRET_CIPHER_PORT,
  MFA_TOTP_PORT,
  PASSWORD_HASHER,
  ReactivateUserHandler,
  RevokeRoleHandler,
  USER_LOOKUP_PORT,
  USER_REPOSITORY,
} from '@platform/users/application';
import { RolesPermissionsModule } from '@platform/roles-permissions/infrastructure';
import { CompaniesModule } from '@platform/companies/infrastructure';

import { Aes256GcmMfaSecretCipher } from './providers/aes256-gcm-mfa-secret-cipher.provider';
import { Argon2PasswordHasher } from './providers/argon2-password-hasher.provider';
import { OtplibMfaTotpProvider } from './providers/otplib-mfa-totp.provider';
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
    { provide: MFA_TOTP_PORT, useClass: OtplibMfaTotpProvider },
    { provide: MFA_SECRET_CIPHER_PORT, useClass: Aes256GcmMfaSecretCipher },
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
  // MFA_TOTP_PORT/MFA_SECRET_CIPHER_PORT exportados para MFA TOTP (docs/persistence/
  // 10-DECISIONES.md #111) - VerifyMfaLoginHandler (platform-identity) los necesita para
  // descifrar el secret de un User y verificar el codigo presentado en el 2do factor.
  exports: [USER_LOOKUP_PORT, PASSWORD_HASHER, MFA_TOTP_PORT, MFA_SECRET_CIPHER_PORT],
})
export class UsersModule {}
